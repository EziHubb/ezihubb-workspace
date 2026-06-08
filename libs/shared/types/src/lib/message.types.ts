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
}

export interface ConversationWithMessagesDto extends ConversationDto {
  messages: MessageDto[];
}
