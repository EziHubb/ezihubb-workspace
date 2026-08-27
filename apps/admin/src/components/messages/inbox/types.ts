/** Shapes returned by /admin/messages/*. */

export const FOLDERS = [
  'inbox', 'starred', 'order_help', 'prospective_buyers', 'from_platform',
  'sent', 'all', 'unread', 'spam', 'trash',
] as const;

export type Folder = (typeof FOLDERS)[number];

/** Sidebar order and wording. Kept beside the type so a new folder cannot be
 *  added to one without the other noticing. */
export const FOLDER_LABELS: Record<Folder, string> = {
  inbox:              'Inbox',
  starred:            'Starred',
  order_help:         'Order help requests',
  prospective_buyers: 'From potential buyers',
  from_platform:      'From the platform',
  sent:               'Sent',
  all:                'All',
  unread:             'Unread',
  spam:               'Spam',
  trash:              'Trash',
};

export type FolderCounts = Record<Folder, number>;

export type LabelColor = 'muted' | 'primary' | 'success' | 'warning' | 'error';

export interface ConversationLabel {
  id:     string;
  name:   string;
  color:  LabelColor;
  _count?: { links: number };
}

export interface ConversationBuyer {
  id?:        string | null;
  firstName?: string | null;
  lastName?:  string | null;
  email?:     string;
  avatarUrl?: string | null;
}

export interface ConversationRow {
  id:               string;
  subject:          string | null;
  lastMessage:      string | null;
  lastMessageAt:    string | null;
  status:           string;
  isStarred:        boolean;
  hasSellerReplied: boolean;
  unreadByAdmin:    number;
  guestName:        string | null;
  guestEmail:       string | null;
  orderId:          string | null;
  user:             ConversationBuyer | null;
  order:            { id: string; orderNumber: string } | null;
  labels:           ConversationLabel[];
}

export interface ConversationListResponse {
  items: ConversationRow[];
  meta:  { total: number; page: number; limit: number; totalPages: number };
}

export interface AttachedProduct {
  id:             string;
  name:           string;
  slug:           string;
  price:          number;
  compareAtPrice: number | null;
  imageUrl:       string | null;
}

export interface ThreadMessage {
  id:              string;
  senderType:      'CUSTOMER' | 'SHOP' | 'SYSTEM';
  body:            string;
  attachmentUrls:  string[];
  attachedProduct: AttachedProduct | null;
  createdAt:       string;
  /**
   * Read by the OTHER side, not by whoever is looking.
   *
   * markCustomerRead sets this on every non-CUSTOMER message, so on a SHOP
   * message it means the buyer has seen it — which is the only direction
   * worth drawing here. On a CUSTOMER message it means the shop has, which
   * the shop already knows by virtue of reading it.
   */
  isRead:          boolean;
  /** Set when the shop unsent it. `body` and `attachmentUrls` come back
   *  empty with it — the row keeps its text in the database, not in the API. */
  deletedAt:       string | null;
  /** The key the sender minted, used to match an optimistic bubble to the row
   *  that came back for it. Null for anything the server wrote itself. */
  clientMessageId?: string | null;
}

export interface ConversationDetail extends ConversationRow {
  /** The NEWEST page, oldest-first. Walk backwards with `oldestMessageId`. */
  messages: ThreadMessage[];
  /** Whether anything lies before `messages[0]`. */
  hasMoreMessages?: boolean;
  /** Cursor for the next page back: send as `before`. */
  oldestMessageId?: string | null;
}

/** One page of older messages, oldest-first. */
export interface MessagePage {
  messages: ThreadMessage[];
  hasMoreMessages: boolean;
  oldestMessageId: string | null;
}

export interface BuyerPanel {
  buyerKey:       string | null;
  name:           string;
  avatarUrl:      string | null;
  location:       string | null;
  note:           string | null;
  isFirstContact: boolean;
  orders:         BuyerOrder[];
  /** Length of `orders`, which the API caps — not a lifetime total. */
  orderCount:     number;
}

/** One of the buyer's orders with THIS shop, as the panel lists them. */
export interface BuyerOrder {
  storeOrderId: string;
  orderId:      string;
  orderNumber:  string;
  status:       string;
  itemCount:    number;
  /** What this shop earns on it. Already a number — the API converts the Decimal. */
  total:        number;
  createdAt:    string;
}

export interface AutoReply {
  message:     string;
  activeUntil: string | null;
  isActive:    boolean;
}

export type BulkAction =
  | 'star' | 'unstar' | 'read' | 'unread'
  | 'archive' | 'trash' | 'spam' | 'restore';

/** Chip classes per palette token. Written out rather than interpolated —
 *  Tailwind only emits classes it can see as complete strings. */
export const LABEL_CHIP: Record<LabelColor, string> = {
  muted:   'bg-background text-muted',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error:   'bg-error/10 text-error',
};

/** "3 hours ago" without pulling in a date library. */
export function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function buyerNameOf(c: ConversationRow): string {
  const full = [c.user?.firstName, c.user?.lastName].filter(Boolean).join(' ');
  return full || c.guestName || c.guestEmail || c.user?.email || 'Guest';
}
