export interface B2CResultDto {
  Result: {
    ConversationID: string;
    OriginatorConversationID: string;
    ResultCode: number;
    ResultDesc: string;
    ResultParameters?: {
      ResultParameter: Array<{
        Key: string;
        Value: string | number;
      }>;
    };
  };
}

export interface TransactionStatusResultDto {
  Result: {
    ConversationID: string;
    OriginatorConversationID: string;
    ResultCode: number;
    ResultDesc: string;
    ResultParameters?: {
      ResultParameter: Array<{
        Key: string;
        Value: string | number;
      }>;
    };
  };
}

export interface AccountBalanceResultDto {
  Result: {
    ConversationID: string;
    OriginatorConversationID: string;
    ResultCode: number;
    ResultDesc: string;
    ResultParameters?: {
      ResultParameter: Array<{
        Key: string;
        Value: string | number;
      }>;
    };
  };
}