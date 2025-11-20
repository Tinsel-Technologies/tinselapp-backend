import { Injectable, Logger } from '@nestjs/common';
import { MpesaCallbackDto, ProcessedCallback } from './dto/callback.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';
import { MpesaSecurityService } from './mpesa-security.service';
import { ConfigService } from '@nestjs/config';

interface AuthResponse {
  access_token: string;
  expires_in: number;
}

interface PaymentRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: string;
  Amount: number;
  PartyA: string;
  PartyB: string;
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string;
  TransactionDesc: string;
}

export interface PaymentResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface ErrorResponse {
  requestId: string;
  errorCode: string;
  errorMessage: string;
}

export interface PaymentDto {
  amount: number;
  phoneNumber: string;
}

interface B2CRequest {
  OriginatorConversationID: string;
  InitiatorName: string;
  SecurityCredential: string;
  CommandID: string;
  Amount: number;
  PartyA: string;
  PartyB: string;
  Remarks: string;
  QueueTimeOutURL: string;
  ResultURL: string;
  Occasion: string;
}

export interface B2CResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

export interface B2CDto {
  amount: number;
  phoneNumber: string;
  remarks?: string;
  occasion?: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  private readonly consumerKey =
    'j2dniwbVn7G35PimKt4RAzifEhXMsuGXK6kqpPjnurgxikFB';
  private readonly consumerSecret =
    'C8fUfAAFWnm8vqt4MNSGGezj93u0CXDTGiqIV8DJqLX7uXB6huyyux7ODWwpKTOf';
  private readonly businessShortCode = '4186271';
  private readonly initiatorName = 'GEOFREYTEGERET';
  private readonly b2cQueueTimeOutURL =
    'https://tinsel-backend-app-e9iwg.ondigitalocean.app/api/v1/pay/b2c-timeout';
  private readonly b2cResultURL =
    'https://tinsel-backend-app-e9iwg.ondigitalocean.app/api/v1/pay/b2c-result';
  private readonly passkey =
    '1e87335f6f6f0251c19c8eca632c425953d426c41b40ee4c31b68de5b665cdcb';
  private readonly password = 'Tin@105117';

  constructor(
    private prisma: PrismaService,
    private readonly mpesaSecurityService: MpesaSecurityService, // This is the crucial line
    private readonly configService: ConfigService,
  ) {}

  async getAccessToken(): Promise<string | null> {
    const buffer = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`);
    const basicHeader = buffer.toString('base64');
    const headers = new Headers();
    headers.append('Authorization', `Basic ${basicHeader}`);

    try {
      const response = await fetch(
        'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        { headers },
      );

      if (!response.ok) {
        console.error(
          'Auth response not ok:',
          response.status,
          response.statusText,
        );
        return null;
      }

      const result: AuthResponse = await response.json();
      return result?.access_token || null;
    } catch (error) {
      console.error('Error fetching access token:', error);
      return null;
    }
  }

  private generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  async mpesaPayment(
    paymentData: PaymentDto,
    userId: string,
  ): Promise<PaymentResponse | ErrorResponse | null> {
    const { amount, phoneNumber } = paymentData;

    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const timestamp = this.generateTimestamp();
    const accountReference = `Tinsel Payment-${Date.now()}`;

    const password = Buffer.from(
      `${this.businessShortCode}${this.passkey}${timestamp}`,
    ).toString('base64');

    const paymentRequest: PaymentRequest = {
      BusinessShortCode: this.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: this.businessShortCode,
      PhoneNumber: formattedPhone,
      CallBackURL:
        'https://tinsel-backend-app-e9iwg.ondigitalocean.app/api/v1/pay/callback',
      AccountReference: accountReference,
      TransactionDesc: `Payment of KES ${amount}`,
    };

    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        throw new Error('Failed to retrieve access token');
      }

      const headers = new Headers();
      headers.append('Authorization', `Bearer ${accessToken}`);
      headers.append('Content-Type', 'application/json');

      console.log(
        'Payment request payload:',
        JSON.stringify(paymentRequest, null, 2),
      );

      const response = await fetch(
        'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        {
          method: 'POST',
          headers,
          body: JSON.stringify(paymentRequest),
        },
      );

      if (!response.ok) {
        console.error(
          'Payment response not ok:',
          response.status,
          response.statusText,
        );
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        return null;
      }

      const responseText = await response.text();
      console.log('Raw response:', responseText);

      if (!responseText) {
        console.error('Empty response from M-Pesa API');
        return null;
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response JSON:', parseError);
        return null;
      }

      console.log('Parsed payment response:', result);

      if (result.CheckoutRequestID) {
        await this.prisma.payment.create({
          data: {
            userId,
            merchantRequestId: result.MerchantRequestID,
            checkoutRequestId: result.CheckoutRequestID,
            amount,
            phoneNumber: formattedPhone,
            accountReference,
            transactionDesc: paymentRequest.TransactionDesc,
            responseCode: result.ResponseCode,
            responseDescription: result.ResponseDescription,
            customerMessage: result.CustomerMessage,
            status: PaymentStatus.PENDING,
          },
        });
      }

      if (result.errorCode || result.errorMessage) {
        console.error('M-Pesa API error:', result);
        return result as ErrorResponse;
      }

      return result as PaymentResponse;
    } catch (error) {
      console.error('Error processing payment:', error);
      return null;
    }
  }

  async processCallback(
    callbackData: MpesaCallbackDto,
  ): Promise<ProcessedCallback> {
    const { stkCallback } = callbackData.Body;

    console.log(
      'Processing M-Pesa callback:',
      JSON.stringify(stkCallback, null, 2),
    );
    const payment = await this.prisma.payment.findUnique({
      where: { checkoutRequestId: stkCallback.CheckoutRequestID },
    });

    if (!payment) {
      console.error(
        `FATAL: Payment record not found for CheckoutRequestID: ${stkCallback.CheckoutRequestID}. Callback data will not be saved.`,
      );
      return {
        merchantRequestId: stkCallback.MerchantRequestID,
        checkoutRequestId: stkCallback.CheckoutRequestID,
        resultCode: stkCallback.ResultCode,
        resultDesc: 'Error: Original payment record not found.',
      };
    }

    const processedCallback: ProcessedCallback = {
      merchantRequestId: stkCallback.MerchantRequestID,
      checkoutRequestId: stkCallback.CheckoutRequestID,
      resultCode: stkCallback.ResultCode,
      resultDesc: stkCallback.ResultDesc,
    };

    if (stkCallback.ResultCode === 0 && stkCallback.CallbackMetadata) {
      const metadata = stkCallback.CallbackMetadata.Item;
      metadata.forEach((item) => {
        switch (item.Name) {
          case 'Amount':
            processedCallback.amount = Number(item.Value);
            break;
          case 'MpesaReceiptNumber':
            processedCallback.mpesaReceiptNumber = String(item.Value);
            break;
          case 'TransactionDate':
            processedCallback.transactionDate = String(item.Value);
            break;
          case 'PhoneNumber':
            processedCallback.phoneNumber = String(item.Value);
            break;
        }
      });
    }

    const newStatus =
      stkCallback.ResultCode === 0
        ? PaymentStatus.COMPLETED
        : PaymentStatus.FAILED;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: newStatus },
        });

        await tx.paymentCallback.create({
          data: {
            paymentId: payment.id,
            merchantRequestId: stkCallback.MerchantRequestID,
            checkoutRequestId: stkCallback.CheckoutRequestID,
            resultCode: stkCallback.ResultCode,
            resultDesc: stkCallback.ResultDesc,
            amount: processedCallback.amount,
            mpesaReceiptNumber: processedCallback.mpesaReceiptNumber,
            transactionDate: processedCallback.transactionDate,
            phoneNumber: processedCallback.phoneNumber,
          },
        });

        if (newStatus === PaymentStatus.COMPLETED && payment.userId) {
          await tx.userBalance.upsert({
            where: { userId: payment.userId },
            update: {
              availableBalance: {
                increment: processedCallback.amount,
              },
            },
            create: {
              userId: payment.userId,
              availableBalance: processedCallback.amount,
            },
          });
          this.logger.log(
            `Updated balance for user ${payment.userId} by ${processedCallback.amount}`,
          );
        }
      });

      this.logger.log(
        `Successfully processed callback for Payment ${payment.id}. Status: ${newStatus}`,
      );
    } catch (error) {
      console.error(
        `Error during database transaction for CheckoutRequestID: ${stkCallback.CheckoutRequestID}`,
        error,
      );
    }

    return processedCallback;
  }

  async getPaymentStatus(checkoutRequestId: string): Promise<any> {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { checkoutRequestId },
        include: { callback: true },
      });

      return payment;
    } catch (error) {
      console.error('Error fetching payment status:', error);
      return null;
    }
  }

  private formatPhoneNumber(phoneNumber: string): string {
    let cleaned = phoneNumber.replace(/[\s\-\+]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    }
    if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned;
    }
    return cleaned;
  }

  async b2cSalaryPayment(
    paymentData: B2CDto,
    userId: string,
  ): Promise<B2CResponse | ErrorResponse | null> {
    const {
      amount,
      phoneNumber,
      remarks = 'Salary Payment',
      occasion = 'Salary',
    } = paymentData;

    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const securityCredential =
      this.mpesaSecurityService.generateSecurityCredential(this.password);

    const b2cRequest: B2CRequest = {
      OriginatorConversationID: crypto.randomUUID(),
      InitiatorName: this.initiatorName,
      SecurityCredential: securityCredential,
      CommandID: 'SalaryPayment',
      Amount: amount,
      PartyA: this.businessShortCode,
      PartyB: formattedPhone,
      Remarks: remarks,
      QueueTimeOutURL: this.b2cQueueTimeOutURL,
      ResultURL: this.b2cResultURL,
      Occasion: occasion,
    };

    try {
      const userBalance = await this.prisma.userBalance.findUnique({
        where: { userId },
      });

      if (!userBalance || userBalance.availableBalance < amount) {
        throw new Error('Insufficient balance for salary payment');
      }

      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        throw new Error('Failed to retrieve access token');
      }

      const headers = new Headers();
      headers.append('Authorization', `Bearer ${accessToken}`);
      headers.append('Content-Type', 'application/json');

      console.log(
        'B2C Salary Payment request:',
        JSON.stringify(b2cRequest, null, 2),
      );

      const response = await fetch(
        'https://api.safaricom.co.ke/mpesa/b2c/v3/paymentrequest',
        {
          method: 'POST',
          headers,
          body: JSON.stringify(b2cRequest),
        },
      );

      if (!response.ok) {
        console.error(
          'B2C response not ok:',
          response.status,
          response.statusText,
        );
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        return null;
      }

      const responseText = await response.text();
      console.log('Raw B2C response:', responseText);

      if (!responseText) {
        console.error('Empty response from M-Pesa B2C API');
        return null;
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse B2C response JSON:', parseError);
        return null;
      }

      console.log('Parsed B2C response:', result);

      if (result.ConversationID) {
        await this.prisma.b2CTransaction.create({
          data: {
            userId,
            conversationId: result.ConversationID,
            originatorConversationId: result.OriginatorConversationID,
            amount,
            phoneNumber: formattedPhone,
            remarks,
            occasion,
            commandID: 'SalaryPayment',
            responseCode: result.ResponseCode,
            responseDescription: result.ResponseDescription,
            status: 'PENDING',
          },
        });

        await this.prisma.userBalance.update({
          where: { userId },
          data: {
            availableBalance: {
              decrement: amount,
            },
          },
        });

        this.logger.log(
          `Salary payment initiated: ${amount} to ${formattedPhone}`,
        );
      }

      if (result.errorCode || result.errorMessage) {
        console.error('M-Pesa B2C API error:', result);
        return result as ErrorResponse;
      }

      return result as B2CResponse;
    } catch (error) {
      console.error('Error processing B2C salary payment:', error);
      return null;
    }
  }

  async queryTransactionStatus(
    transactionId: string,
    userId: string,
  ): Promise<any> {
    const securityCredential =
      this.mpesaSecurityService.generateSecurityCredential(this.password);

    const queryRequest = {
      Initiator: this.initiatorName,
      SecurityCredential: securityCredential,
      CommandID: 'TransactionStatusQuery',
      TransactionID: transactionId,
      PartyA: this.businessShortCode,
      IdentifierType: '4',
      ResultURL: `${this.b2cResultURL}/status`,
      QueueTimeOutURL: `${this.b2cQueueTimeOutURL}/status`,
      Remarks: 'Transaction status query',
      Occasion: 'Status Check',
    };

    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        throw new Error('Failed to retrieve access token');
      }

      const headers = new Headers();
      headers.append('Authorization', `Bearer ${accessToken}`);
      headers.append('Content-Type', 'application/json');

      const response = await fetch(
        'https://api.safaricom.co.ke/mpesa/transactionstatus/v1/query',
        {
          method: 'POST',
          headers,
          body: JSON.stringify(queryRequest),
        },
      );

      if (!response.ok) {
        console.error(
          'Transaction status query failed:',
          response.status,
          response.statusText,
        );
        return null;
      }

      const result = await response.json();
      console.log('Transaction status response:', result);

      return result;
    } catch (error) {
      console.error('Error querying transaction status:', error);
      return null;
    }
  }

  async queryAccountBalance(userId: string): Promise<any> {
    const securityCredential =
      this.mpesaSecurityService.generateSecurityCredential();

    const balanceRequest = {
      Initiator: this.initiatorName,
      SecurityCredential: securityCredential,
      CommandID: 'AccountBalance',
      PartyA: this.businessShortCode,
      IdentifierType: '4',
      Remarks: 'Account balance query',
      QueueTimeOutURL: `${this.b2cQueueTimeOutURL}/balance`,
      ResultURL: `${this.b2cResultURL}/balance`,
    };

    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        throw new Error('Failed to retrieve access token');
      }

      const headers = new Headers();
      headers.append('Authorization', `Bearer ${accessToken}`);
      headers.append('Content-Type', 'application/json');

      const response = await fetch(
        'https://api.safaricom.co.ke/mpesa/accountbalance/v1/query',
        {
          method: 'POST',
          headers,
          body: JSON.stringify(balanceRequest),
        },
      );

      if (!response.ok) {
        console.error(
          'Account balance query failed:',
          response.status,
          response.statusText,
        );
        return null;
      }

      const result = await response.json();
      console.log('Account balance response:', result);

      return result;
    } catch (error) {
      console.error('Error querying account balance:', error);
      return null;
    }
  }

  async b2cBusinessPayment(
    paymentData: B2CDto,
    userId: string,
  ): Promise<B2CResponse | ErrorResponse | null> {
    const {
      amount,
      phoneNumber,
      remarks = 'Business Payment',
      occasion = 'Payment',
    } = paymentData;

    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const securityCredential =
      this.mpesaSecurityService.generateSecurityCredential();

    const b2cRequest: B2CRequest = {
      OriginatorConversationID: crypto.randomUUID(),
      InitiatorName: this.initiatorName,
      SecurityCredential: securityCredential,
      CommandID: 'BusinessPayment',
      Amount: amount,
      PartyA: this.businessShortCode,
      PartyB: formattedPhone,
      Remarks: remarks,
      QueueTimeOutURL: this.b2cQueueTimeOutURL,
      ResultURL: this.b2cResultURL,
      Occasion: occasion,
    };

    try {
      const userBalance = await this.prisma.userBalance.findUnique({
        where: { userId },
      });

      if (!userBalance || userBalance.availableBalance < amount) {
        throw new Error('Insufficient balance for business payment');
      }

      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        throw new Error('Failed to retrieve access token');
      }

      const headers = new Headers();
      headers.append('Authorization', `Bearer ${accessToken}`);
      headers.append('Content-Type', 'application/json');

      const response = await fetch(
        'https://api.safaricom.co.ke/mpesa/b2c/v3/paymentrequest',
        {
          method: 'POST',
          headers,
          body: JSON.stringify(b2cRequest),
        },
      );

      if (!response.ok) {
        console.error(
          'B2C Business payment failed:',
          response.status,
          response.statusText,
        );
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        return null;
      }

      const result = await response.json();

      if (result.ConversationID) {
        await this.prisma.b2CTransaction.create({
          data: {
            userId,
            conversationId: result.ConversationID,
            originatorConversationId: result.OriginatorConversationID,
            amount,
            phoneNumber: formattedPhone,
            remarks,
            occasion,
            commandID: 'BusinessPayment',
            responseCode: result.ResponseCode,
            responseDescription: result.ResponseDescription,
            status: 'PENDING',
          },
        });

        await this.prisma.userBalance.update({
          where: { userId },
          data: {
            availableBalance: {
              decrement: amount,
            },
          },
        });

        this.logger.log(
          `Business payment initiated: ${amount} to ${formattedPhone}`,
        );
      }

      return result;
    } catch (error) {
      console.error('Error processing B2C business payment:', error);
      return null;
    }
  }

  async processB2CResult(resultData: any): Promise<any> {
    const { Result } = resultData;

    console.log('Processing B2C result:', JSON.stringify(Result, null, 2));

    const transaction = await this.prisma.b2CTransaction.findUnique({
      where: { conversationId: Result.ConversationID },
    });

    if (!transaction) {
      console.error(
        `B2C transaction not found for ConversationID: ${Result.ConversationID}`,
      );
      return { error: 'Transaction not found' };
    }

    const isSuccess = Result.ResultCode === 0;
    const newStatus = isSuccess ? 'COMPLETED' : 'FAILED';

    let transactionDetails = {
      transactionId: null,
      transactionReceipt: null,
      recipientRegistered: null,
      charges: null,
      transactionCompletedDateTime: null,
      receiverPartyPublicName: null,
    };

    if (isSuccess && Result.ResultParameters?.ResultParameter) {
      Result.ResultParameters.ResultParameter.forEach((param: any) => {
        switch (param.Key) {
          case 'TransactionID':
            transactionDetails.transactionId = param.Value;
            break;
          case 'TransactionReceipt':
            transactionDetails.transactionReceipt = param.Value;
            break;
          case 'ReceiverPartyPublicName':
            transactionDetails.receiverPartyPublicName = param.Value;
            break;
          case 'TransactionCompletedDateTime':
            transactionDetails.transactionCompletedDateTime = param.Value;
            break;

          case 'B2CRecipientIsRegisteredCustomer':
            transactionDetails.recipientRegistered = param.Value;
            break;
          case 'B2CChargesPaidAccountAvailableFunds':
            transactionDetails.charges = parseFloat(param.Value) as any;
            break;
        }
      });
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.b2CTransaction.update({
          where: { id: transaction.id },
          data: {
            status: newStatus,
            resultCode: Result.ResultCode,
            resultDesc: Result.ResultDesc,
            transactionId: transactionDetails.transactionId,
            transactionReceipt: transactionDetails.transactionReceipt,
            recipientRegistered: transactionDetails.recipientRegistered,
            charges: transactionDetails.charges,
            transactionCompletedDateTime:
              transactionDetails.transactionCompletedDateTime,
            receiverPartyPublicName: transactionDetails.receiverPartyPublicName,
          },
        });

        if (!isSuccess && transaction.userId) {
          await tx.userBalance.update({
            where: { userId: transaction.userId },
            data: {
              availableBalance: {
                increment: transaction.amount,
              },
            },
          });
          this.logger.log(
            `Refunded ${transaction.amount} to user ${transaction.userId} due to failed B2C`,
          );
        }
      });

      this.logger.log(
        `B2C transaction ${transaction.id} updated to ${newStatus}`,
      );
    } catch (error) {
      console.error('Error updating B2C transaction:', error);
    }

    return {
      conversationId: Result.ConversationID,
      resultCode: Result.ResultCode,
      resultDesc: Result.ResultDesc,
      status: newStatus,
    };
  }

  async processB2CTimeout(timeoutData: any): Promise<any> {
    const { Result } = timeoutData;

    console.log('Processing B2C timeout:', JSON.stringify(Result, null, 2));

    const transaction = await this.prisma.b2CTransaction.findUnique({
      where: { conversationId: Result.ConversationID },
    });

    if (!transaction) {
      console.error(
        `B2C transaction not found for ConversationID: ${Result.ConversationID}`,
      );
      return { error: 'Transaction not found' };
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.b2CTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'TIMEOUT',
            resultCode: Result.ResultCode,
            resultDesc: Result.ResultDesc,
          },
        });

        if (transaction.userId) {
          await tx.userBalance.update({
            where: { userId: transaction.userId },
            data: {
              availableBalance: {
                increment: transaction.amount,
              },
            },
          });
          this.logger.log(
            `Refunded ${transaction.amount} to user ${transaction.userId} due to B2C timeout`,
          );
        }
      });

      this.logger.log(`B2C transaction ${transaction.id} marked as timeout`);
    } catch (error) {
      console.error('Error handling B2C timeout:', error);
    }

    return {
      conversationId: Result.ConversationID,
      status: 'TIMEOUT',
    };
  }

  async getB2CTransactionStatus(conversationId: string): Promise<any> {
    try {
      const transaction = await this.prisma.b2CTransaction.findUnique({
        where: { conversationId },
      });

      return transaction;
    } catch (error) {
      console.error('Error fetching B2C transaction status:', error);
      return null;
    }
  }

  // async getB2CHistory(userId?: string): Promise<any[]> {
  //   try {
  //     const transactions = await this.prisma.b2CTransaction.findMany({
  //       where: userId ? { userId } : {},
  //       orderBy: { createdAt: 'desc' },
  //     });

  //     return transactions;
  //   } catch (error) {
  //     console.error('Error fetching B2C history:', error);
  //     return [];
  //   }
  // }

  async getB2CHistory(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: string,
  ): Promise<{
    data: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    try {
      const skip = (page - 1) * limit;
      const whereClause: any = {
        userId,
      };

      if (status) {
        whereClause.status = status;
      }

      const totalCount = await this.prisma.b2CTransaction.count({
        where: whereClause,
      });

      const transactions = await this.prisma.b2CTransaction.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          conversationId: true,
          originatorConversationId: true,
          amount: true,
          phoneNumber: true,
          remarks: true,
          occasion: true,
          commandID: true,
          responseCode: true,
          responseDescription: true,
          status: true,
          resultCode: true,
          resultDesc: true,
          transactionId: true,
          transactionReceipt: true,
          recipientRegistered: true,
          charges: true,
          transactionCompletedDateTime: true,
          receiverPartyPublicName: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const totalPages = Math.ceil(totalCount / limit);

      return {
        data: transactions,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error fetching B2C history:', error);
      return {
        data: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }
  }

  async getPaymentHistory(
    userId: string,
    page: number = 1,
    limit: number = 10,
    phoneNumber?: string,
    status?: string,
  ): Promise<{
    data: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    try {
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {
        userId, // Filter by specific user
      };

      if (phoneNumber) {
        whereClause.phoneNumber = this.formatPhoneNumber(phoneNumber);
      }

      if (status) {
        whereClause.status = status;
      }

      // Get total count for pagination
      const totalCount = await this.prisma.payment.count({
        where: whereClause,
      });

      // Get paginated data
      const payments = await this.prisma.payment.findMany({
        where: whereClause,
        include: {
          callback: {
            select: {
              id: true,
              resultCode: true,
              resultDesc: true,
              amount: true,
              mpesaReceiptNumber: true,
              transactionDate: true,
              phoneNumber: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      const totalPages = Math.ceil(totalCount / limit);

      return {
        data: payments,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error fetching payment history:', error);
      return {
        data: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }
  }
}
