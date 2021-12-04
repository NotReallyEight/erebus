import { AsyncQueue } from "@sapphire/async-queue";
import type {
	Client,
	Json,
	Path,
	RateLimitHandler,
	RateLimitResponse,
	RequestMethod,
	RequestOptions,
} from "..";
import { setPromiseTimeout } from "../Util";
import APIRequest from "./APIRequest";
import { DiscordError } from "./DiscordError";

/**
 * A rest manager for the client
 */
export class Rest {
	/**
	 * The client that instantiated this
	 */
	client: Client;

	/**
	 * Number of invalid requests done in the last 10 minutes
	 */
	invalidRequests = 0;

	/**
	 * When the invalid requests were last reset
	 */
	invalidRequestsResetAt = Date.now();

	/**
	 * A queue for the requests
	 */
	queue = new AsyncQueue();

	/**
	 * An array of all the rate limit data received from the API
	 */
	rateLimits: RateLimitHandler[] = [];

	/**
	 * All requests that have been made so far
	 */
	requests: APIRequest[] = [];

	/**
	 * Number of requests done in the last second
	 */
	requestsPerSec = 0;

	/**
	 * When the requests per second were last reset
	 */
	requestPerSecResetAt = Date.now();

	/**
	 * @param client - The client that instantiated this
	 */
	constructor(client: Client) {
		this.client = client;

		// Reset the request per second every second
		setInterval(() => {
			this.requestsPerSec = 0;
			this.requestPerSecResetAt = Date.now();
		}, 1_000).unref();

		// Reset invalid requests every 10 minutes
		setInterval(() => {
			this.invalidRequests = 0;
			this.invalidRequestsResetAt = Date.now();
		}, 600_000).unref();
	}

	/**
	 * Make a GET request to the API.
	 * @param path - The path to request
	 * @param options - Other options for this request
	 * @param retry - If the request should be retried in case of a 5xx response
	 * @template T The return type that should be used by the function
	 * @returns The JSON data received from the API or null if no data was received
	 */
	get<T = Json | null>(
		path: Path,
		options?: Omit<RequestOptions, "attachments" | "body">,
		retry?: boolean
	): Promise<T> {
		return this.request(path, "GET", options, retry);
	}

	/**
	 * Make a DELETE request to the API.
	 * @param path - The path to request
	 * @param options - Other options for this request
	 * @param retry - If the request should be retried in case of a 5xx response
	 * @template T The return type that should be used by the function
	 * @returns The JSON data received from the API or null if no data was received
	 */
	delete<T = Json | null>(
		path: Path,
		options?: RequestOptions,
		retry?: boolean
	): Promise<T> {
		return this.request(path, "DELETE", options, retry);
	}

	/**
	 * Make a PATCH request to the API.
	 * @param path - The path to request
	 * @param options - Other options for this request
	 * @param retry - If the request should be retried in case of a 5xx response
	 * @template T The return type that should be used by the function
	 * @returns The JSON data received from the API or null if no data was received
	 */
	patch<T = Json | null>(
		path: Path,
		options?: RequestOptions,
		retry?: boolean
	): Promise<T> {
		return this.request(path, "PATCH", options, retry);
	}

	/**
	 * Make a POST request to the API.
	 * @param path - The path to request
	 * @param options - Other options for this request
	 * @param retry - If the request should be retried in case of a 5xx response
	 * @template T The return type that should be used by the function
	 * @returns The JSON data received from the API or null if no data was received
	 */
	post<T = Json | null>(
		path: Path,
		options?: RequestOptions,
		retry?: boolean
	): Promise<T> {
		return this.request(path, "POST", options, retry);
	}

	/**
	 * Make a PUT request to the API.
	 * @param path - The path to request
	 * @param options - Other options for this request
	 * @param retry - If the request should be retried in case of a 5xx response
	 * @template T The return type that should be used by the function
	 * @returns The JSON data received from the API or null if no data was received
	 */
	put<T = Json | null>(
		path: Path,
		options?: RequestOptions,
		retry?: boolean
	): Promise<T> {
		return this.request(path, "PUT", options, retry);
	}

	/**
	 * Make a request to the API.
	 * @param path - The path to request
	 * @param method - The method of the request
	 * @param options - Other options for this request
	 * @param retry - If the request should be retried in case of a 5xx response
	 * @template T The return type that should be used by the function
	 * @returns The JSON data received from the API or null if no data was received
	 */
	request<T = Json | null>(
		path: Path,
		method: "GET",
		options?: Omit<RequestOptions, "attachments" | "body">,
		retry?: boolean
	): Promise<T>;
	request<T = Json | null>(
		path: Path,
		method: Exclude<RequestMethod, "GET">,
		options?: RequestOptions,
		retry?: boolean
	): Promise<T>;
	async request(
		path: Path,
		method: RequestMethod,
		options: RequestOptions,
		retry = true
	) {
		await this.queue.wait();

		const request = new APIRequest(this, path, method, options);
		const { route } = request;

		this.requests.push(request);

		// If we already passed the limit wait until all parameters are ok
		await this.wait({ method, route });
		this.requestsPerSec++;

		let data;
		const res = await request.send();
		const bucket = res.headers["x-ratelimit-bucket"] as string | undefined;
		const limit = Number(
			res.headers["x-ratelimit-limit"] as string | undefined
		);

		// Check if it's an invalid request
		if ([401, 403, 429].includes(res.statusCode)) this.invalidRequests++;
		if (res.statusCode === 429) {
			data = JSON.parse(res.data!) as RateLimitResponse;

			// If we encountered a ratelimit, use the retryAfter data
			await setPromiseTimeout(data.retry_after * 1000);
			this.queue.shift();
			if (!data.global)
				if (bucket != null && limit)
					this.handleBucket(
						bucket,
						method,
						route,
						limit,
						Date.now() +
							Number(
								res.headers["x-ratelimit-reset-after"] as string | undefined
							) *
								1000
					);

			return this.request(path, method as "DELETE", options);
		}

		if (bucket != null && limit)
			this.handleBucket(
				bucket,
				method,
				route,
				limit,
				Number(res.headers["x-ratelimit-reset"] as string | undefined) * 1000,
				Number(res.headers["x-ratelimit-remaining"] as string | undefined)
			);
		if (res.statusCode >= 200 && res.statusCode < 300)
			// If the request is ok parse the data received
			data =
				res.headers["content-type"] === "application/json"
					? (JSON.parse(res.data!) as unknown)
					: res.data;
		else if (res.statusCode >= 300 && res.statusCode < 400)
			// In this case we have no data
			data = null;
		else if (res.statusCode >= 500 && retry) {
			// If there's a server error retry just one time
			this.queue.shift();
			return this.request(path, method as "DELETE", options, false);
		}

		this.queue.shift();
		if (data !== undefined) return data;

		// If we didn't receive a successful response, throw an error
		throw new DiscordError(request, res);
	}

	/**
	 * Handle a received ratelimit data with bucket.
	 * @param bucket - The unique bucket string received from Discord
	 * @param method - The method used for the request
	 * @param route - The route of the request
	 * @param limit - The limit of requests for this bucket
	 * @param reset - When this ratelimit will reset
	 * @param remaining - How many requests remained
	 */
	handleBucket(
		bucket: string,
		method: RequestMethod,
		route: `/${string}`,
		limit: number,
		reset?: number,
		remaining?: number
	) {
		// Find if this bucket is already saved
		let rateLimit = this.rateLimits.find(
			({ bucket: rateLimitBucket }) => rateLimitBucket === bucket
		);

		if (rateLimit) {
			if (!rateLimit.routes.includes(`${method} ${route}`))
				// Add this route and request if it isn't already added
				rateLimit.routes.push(`${method} ${route}`);

			// Update other properties
			rateLimit.limit = limit;
			rateLimit.remaining = remaining ?? rateLimit.remaining - 1;
		} else {
			// Create a new rate limit handler
			rateLimit = {
				bucket,
				limit,
				remaining: remaining ?? limit,
				routes: [`${method} ${route}`],
			};
			this.rateLimits.push(rateLimit);
		}

		// Handle the reset of this bucket if it wasn't already
		if (rateLimit.reset == null && reset != null) {
			rateLimit.reset = reset;
			setTimeout(
				(rLimit: RateLimitHandler) => {
					rLimit.remaining = rLimit.limit;
				},
				reset - Date.now(),
				rateLimit
			).unref();
		}
	}

	/**
	 * Wait until all ratelimits are ok.
	 */
	wait({ method, route }: { method: RequestMethod; route: `/${string}` }) {
		const promises: Promise<void>[] = [];
		const requestsPerSecWillResetIn =
			this.requestPerSecResetAt + 1_000 - Date.now();
		const invalidRequestsWillResetIn =
			this.invalidRequestsResetAt + 600_000 - Date.now();
		const rHandler = this.rateLimits.find((handler) =>
			handler.routes.includes(`${method} ${route}`)
		);

		if (this.requestsPerSec >= 50 && requestsPerSecWillResetIn > 0)
			promises.push(setPromiseTimeout(requestsPerSecWillResetIn));
		if (this.invalidRequests >= 10_000 && invalidRequestsWillResetIn > 0)
			promises.push(setPromiseTimeout(invalidRequestsWillResetIn));
		if (rHandler?.reset != null) {
			const handlerWillResetIn = rHandler.reset * 1_000 - Date.now();

			if (handlerWillResetIn > 0 && rHandler.remaining <= 0)
				promises.push(setPromiseTimeout(handlerWillResetIn));
		}

		return Promise.all(promises);
	}
}

export default Rest;
