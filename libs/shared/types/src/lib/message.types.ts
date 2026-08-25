export type ConversationStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'SPAM';
export type SenderType = 'CUSTOMER' | 'SHOP' | 'SYSTEM';

export interface MessageDto {
  id:              string;
  conversationId:  string;
  senderType:      SenderType;
  senderId:        string | null;
  body:            string;
  attachmentUrls:  string[];
  isRead:          boolean;
  readAt:          string | null;
  createdAt:       string;
  /**
   * Set when the shop unsent this message.
   *
   * `body` and `attachmentUrls` come back empty with it — the row keeps its
   * text in the database, where a moderation report about it stays
   * answerable, but the API stops sending it. The renderer hiding it is not
   * enough on its own: the text was still in the JSON.
   */
  deletedAt?:      string | null;
}

export interface ConversationDto {
  id:               string;
  orderId:          string | null;
  userId:           string | null;
  guestEmail:       string | null;
  guestName:        string | null;
  subject:          string | null;
  status:           ConversationStatus;
  lastMessage:      string | null;
  lastMessageAt:    string | null;
  unreadByAdmin:    number;
  unreadByCustomer: number;
  createdAt:        string;
  updatedAt:        string;
  order?:           { id: string; orderNumber: string } | null;
  user?:            { id: string; firstName: string; lastName: string; email: string; avatarUrl?: string | null } | null;
  /**
   * The shop on the other side. `slug` links its name back to the shop page;
   * `ownerId` is who presence is reported for, since a shop is online exactly
   * when the person who owns it is.
   */
  store?:           { id: string; name: string; slug: string; logoUrl?: string | null; ownerId: string } | null;
}

export interface ConversationWithMessagesDto extends ConversationDto {
  /**
   * The NEWEST page of the thread, oldest-first — not the whole thing.
   *
   * A thread is one shop and one buyer for as long as they deal with each
   * other, so "all of it" has no upper bound. Walk backwards with
   * MessagePageDto and the two fields below.
   */
  messages: MessageDto[];
  /** Whether anything lies before `messages[0]`. */
  hasMoreMessages?: boolean;
  /** Cursor for the next page back: pass as `before`. Null on an empty thread. */
  oldestMessageId?: string | null;
}

/** One page of older messages, oldest-first, from GET …/conversations/:id/messages. */
export interface MessagePageDto {
  messages: MessageDto[];
  hasMoreMessages: boolean;
  oldestMessageId: string | null;
}

/**
 * The card shown under a message that contains a link.
 *
 * Every field is nullable because a page may advertise none of them; the API
 * returns null for the whole preview rather than a card with nothing on it.
 */
export interface LinkPreviewDto {
  url:         string;
  title:       string | null;
  description: string | null;
  image:       string | null;
  siteName:    string | null;
}
