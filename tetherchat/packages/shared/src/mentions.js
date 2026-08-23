/**
 * Mentions are stored in raw form inside message content:
 *   <@userId>       user mention
 *   <#channelId>    channel mention
 *   @everyone       everyone mention
 * The client resolves them to display names at render time so renames propagate.
 */
const USER_MENTION = /<@([a-zA-Z0-9_-]{1,64})>/g;
const CHANNEL_MENTION = /<#([a-zA-Z0-9_-]{1,64})>/g;
const EVERYONE_MENTION = /(^|[\s(])@everyone(?=$|[\s.,!?)])/;
export function extractUserMentions(content) {
    return unique(Array.from(content.matchAll(USER_MENTION), (m) => m[1]));
}
export function extractChannelMentions(content) {
    return unique(Array.from(content.matchAll(CHANNEL_MENTION), (m) => m[1]));
}
export function mentionsEveryone(content) {
    return EVERYONE_MENTION.test(content);
}
export function encodeUserMention(userId) {
    return `<@${userId}>`;
}
export function encodeChannelMention(channelId) {
    return `<#${channelId}>`;
}
/** Splits content into renderable tokens without touching markdown syntax. */
export function tokenizeMentions(content) {
    const pattern = /<@([a-zA-Z0-9_-]{1,64})>|<#([a-zA-Z0-9_-]{1,64})>|@everyone/g;
    const tokens = [];
    let lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
        const index = match.index ?? 0;
        if (index > lastIndex) {
            tokens.push({ type: 'text', value: content.slice(lastIndex, index) });
        }
        if (match[1])
            tokens.push({ type: 'user', id: match[1] });
        else if (match[2])
            tokens.push({ type: 'channel', id: match[2] });
        else
            tokens.push({ type: 'everyone' });
        lastIndex = index + match[0].length;
    }
    if (lastIndex < content.length) {
        tokens.push({ type: 'text', value: content.slice(lastIndex) });
    }
    return tokens;
}
const URL_PATTERN = /https?:\/\/[^\s<>"')]+/g;
export function extractUrls(content, max = 3) {
    return unique(Array.from(content.matchAll(URL_PATTERN), (m) => m[0])).slice(0, max);
}
function unique(values) {
    return Array.from(new Set(values));
}
//# sourceMappingURL=mentions.js.map