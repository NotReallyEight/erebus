import type {
	APIApplication,
	APIChannel,
	APIThreadMember,
	APIThreadMetadata,
	ChannelType,
	Snowflake,
	ThreadAutoArchiveDuration,
	VideoQualityMode,
} from "discord-api-types/v9";
import type { IncomingHttpHeaders, OutgoingHttpHeaders } from "http";
import type { URLSearchParams } from "url";
import type {
	APIRequest,
	Base,
	NewsChannel,
	PrivateChannel,
	StageChannel,
	StoreChannel,
	TextChannel,
	VoiceChannel,
} from ".";

/**
 * An attachment to send to the API
 */
export interface Attachment {
	/**
	 * The name of this attachment
	 */
	name: string;

	/**
	 * The data for this buffer
	 */
	data: Buffer;
}

/**
 * Events emitted by the client
 */
export interface ClientEvents {
	channelCreate: [channel: AnyGuildChannel];
	error: [error: Error];
	ready: [];
	resumed: [];
	warn: [message: string];
}

/**
 * Options to instantiate a client
 */
export interface ClientOptions {
	/**
	 * The token of this client
	 * This defaults to `process.env.DISCORD_TOKEN` if none is provided
	 */
	token?: Token;

	/**
	 * Total number of members where the gateway will stop sending offline members in the guild member list
	 */
	largeThreshold?: number;

	/**
	 * Intents to use for this client
	 */
	intents: Intents;

	/**
	 * An optional user agent to add in the requests to the API
	 * @see https://discord.com/developers/docs/reference#user-agent
	 */
	userAgent?: string;
}

/**
 * The state of the client
 */
export enum ClientStatus {
	Disconnected,
	Connecting,
	Connected,
	Reconnecting,
	Resuming,
}

/**
 * Data about an heartbeat
 */
export interface HeartbeatInfo {
	first: boolean;
	acknowledged: boolean;
}

/**
 * Intents to send to the API
 */
export enum Intents {
	guilds = 1,
	guildMembers = 2,
	guildBans = 4,
	guildEmojis = 8,
	guildIntegrations = 16,
	guildWebhooks = 32,
	guildInvites = 64,
	guildVoiceStates = 128,
	guildPresences = 256,
	guildMessages = 512,
	guildMessageReactions = 1024,
	guildMessageTyping = 2048,
	directMessages = 4096,
	directMessageReactions = 8192,
	directMessageTyping = 16384,
}

/**
 * Any JSON data
 */
export type Json =
	| Json[]
	| boolean
	| number
	| string
	| { [property: string]: Json };

/**
 * The path for a request to the API
 */
export type Path = `/${string}`;

/**
 * Data about ratelimits related to a bucket
 */
export interface RateLimitHandler {
	/**
	 * A unique string denoting the rate limit being encountered
	 */
	bucket: string;

	/**
	 * The number of requests that can be made
	 */
	limit: number;

	/**
	 * The number of remaining requests that can be made
	 */
	remaining: number;

	/**
	 * Epoch time (seconds) at which the rate limit resets
	 */
	reset?: number;

	/**
	 * Routes that share the same bucket
	 */
	routes: `${RequestMethod} ${Path}`[];
}

/**
 * A JSON response from the API with a 429 status code
 */
export interface RateLimitResponse {
	/**
	 * A value indicating if you are being globally rate limited or not
	 */
	global: boolean;

	/**
	 * A message saying you are being rate limited
	 */
	message: string;

	/**
	 * The number of seconds to wait before submitting another request.
	 */
	retry_after: number;
}

/**
 * The method of a request to the API
 */
export type RequestMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

/**
 * The options for this request
 */
export interface RequestOptions {
	/**
	 * The base url for this request
	 */
	url?: string;

	/**
	 * The query of this request
	 */
	query?: URLSearchParams;

	/**
	 * Headers to be sent for this request
	 */
	headers?: OutgoingHttpHeaders;

	/**
	 * Attachments to add to the body of this request
	 */
	attachments?: Attachment[];

	/**
	 * The JSON body of this request
	 */
	body?: Json;
}

/**
 * The status of a request to the API
 */
export enum RequestStatus {
	Pending,
	InProgress,
	Finished,
	Failed,
}

/**
 * A response received from the API
 */
export interface Response {
	/**
	 * The received data
	 */
	data: string | null;

	/**
	 * The status code received for this request
	 */
	statusCode: number;

	/**
	 * Headers received from the API
	 */
	headers: IncomingHttpHeaders;

	/**
	 * The status message received for this request
	 */
	status: string;

	/**
	 * The APIRequest object that instantiated this
	 */
	request: APIRequest;
}

/**
 * A valid token for the API
 */
export type Token = `${string}.${string}.${string}`;

/**
 * Advanced information for a heartbeat
 */
export interface AdvancedHeartbeatInfo extends HeartbeatInfo {
	intervalTime: number;
	interval: NodeJS.Timeout | null;
}

/**
 * Partial Application object sent by the server during Ready event
 */
export type PartialAPIApplication = Pick<APIApplication, "flags" | "id">;

/**
 * Permission overwrite for a specific channel, or for a specific role
 */
export interface Overwrite {
	id: Snowflake;
	type: 0 | 1;
	allow: string;
	deny: string;
}

/**
 * Structure typing for a partial object
 */
export type PartialStructure<T extends Base<any>, E extends keyof T> = {
	[K in keyof T]: T[K] extends (...args: any[]) => any
		? T[K]
		: K extends E | keyof Base<any>
		? T[K]
		: undefined;
};

/**
 * A guild channel type definition
 */
export interface APIGuildChannel extends APIChannel {
	type:
		| ChannelType.GuildCategory
		| ChannelType.GuildNews
		| ChannelType.GuildNewsThread
		| ChannelType.GuildPrivateThread
		| ChannelType.GuildPublicThread
		| ChannelType.GuildStageVoice
		| ChannelType.GuildStore
		| ChannelType.GuildText
		| ChannelType.GuildVoice;
	guild_id: Snowflake;
	position: number;
	permission_overwrites: Overwrite[];
	name: string;
	nsfw: boolean;
	parent_id: Snowflake | null | undefined;
}

/**
 * A guild's text channel type definition
 */
export interface APITextChannel extends APIGuildChannel {
	last_message_id: Snowflake | null;
	last_pin_timestamp?: string | null;
	rate_limit_per_user?: number;
	topic?: string | null;
}

/**
 * A guild's voice channel type definition
 */
export interface APIVoiceChannel extends APIGuildChannel {
	bitrate: number;
	rtc_region: string | null;
	user_limit: number;
	video_quality_mode: VideoQualityMode;
}

/**
 * A guild's thread channel type definition
 */
export interface APIThreadChannel extends APIGuildChannel {
	last_message_id: Snowflake | null;
	member?: APIThreadMember;
	member_count: number;
	message_count: number;
	owner_id: Snowflake;
	rate_limit_per_user?: number;
	thread_metadata?: APIThreadMetadata;
}

/**
 * A guild's thread channel metadata type definition
 */
export interface ThreadChannelMetadata {
	archived: boolean;
	autoArchiveDuration: ThreadAutoArchiveDuration;
	archiveTimestamp: Date;
	locked?: boolean;
	invitable?: boolean;
}

/**
 * A guild's stage channel
 */
export interface APIStageChannel extends APIVoiceChannel {
	topic?: string;
}

/**
 * Type definition for all guild channel classes
 */
export type AnyGuildChannel =
	| NewsChannel
	| StageChannel
	| StoreChannel
	| TextChannel
	| VoiceChannel;

/**
 * Type definition for all channel classes
 */
export type AnyChannel = AnyGuildChannel | PrivateChannel;
