import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Req,
  Query,
  Logger,
} from '@nestjs/common';
import { PaymentService, PaymentDto, B2CDto } from './payment.service';
import { MpesaCallbackDto } from './dto/callback.dto';
import { AuthGuardService } from 'src/auth-guard/auth-guard.service';

@Controller('api/v1/pay')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}
  private readonly logger = new Logger(PaymentController.name);
  @Post('mpesa')
  @UseGuards(AuthGuardService)
  async initiatePayment(@Body() paymentData: PaymentDto, @Req() req: Request) {
    try {
      const userId = (req as any).user.id;
      const result = await this.paymentService.mpesaPayment(
        paymentData,
        userId,
      );

      if (!result) {
        return {
          success: false,
          message: 'Payment initiation failed - no response from M-Pesa',
        };
      }

      if ('errorCode' in result) {
        return {
          success: false,
          message: 'Payment initiation failed',
          error: {
            code: result.errorCode,
            message: result.errorMessage,
          },
        };
      }

      if (result.ResponseCode !== '0') {
        return {
          success: false,
          message: result.ResponseDescription || 'Payment initiation failed',
          data: result,
        };
      }

      return {
        success: true,
        message:
          'Payment initiated successfully. Please check your phone for M-Pesa prompt.',
        data: {
          checkoutRequestId: result.CheckoutRequestID,
          merchantRequestId: result.MerchantRequestID,
          customerMessage: result.CustomerMessage,
        },
      };
    } catch (error) {
      console.error('Controller error:', error);
      return {
        success: false,
        message: 'An error occurred while processing payment',
        error: error.message,
      };
    }
  }

  @Post('callback')
  async handleCallback(@Body() callbackData: MpesaCallbackDto) {
    try {
      console.log(
        'Received M-Pesa callback:',
        JSON.stringify(callbackData, null, 2),
      );

      const processedCallback =
        await this.paymentService.processCallback(callbackData);

      console.log('Processed callback:', processedCallback);

      return {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      };
    } catch (error) {
      console.error('Callback processing error:', error);

      return {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      };
    }
  }

  @Get('status/:checkoutRequestId')
  @UseGuards(AuthGuardService)
  async getPaymentStatus(
    @Param('checkoutRequestId') checkoutRequestId: string,
  ) {
    try {
      const paymentStatus =
        await this.paymentService.getPaymentStatus(checkoutRequestId);

      if (!paymentStatus) {
        return {
          success: false,
          message: 'Payment not found',
        };
      }

      return {
        success: true,
        data: paymentStatus,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error retrieving payment status',
        error: error.message,
      };
    }
  }

  @Post('b2c/salary')
  @UseGuards(AuthGuardService)
  async initiateSalaryPayment(
    @Body() paymentData: B2CDto,
    @Req() req: Request,
  ) {
    try {
      const userId = (req as any).user.id;
      const result = await this.paymentService.b2cSalaryPayment(
        paymentData,
        userId,
      );

      if (!result) {
        return {
          success: false,
          message: 'Salary payment initiation failed - no response from M-Pesa',
        };
      }

      if ('errorCode' in result) {
        return {
          success: false,
          message: 'Salary payment initiation failed',
          error: {
            code: result.errorCode,
            message: result.errorMessage,
          },
        };
      }

      if (result.ResponseCode !== '0') {
        return {
          success: false,
          message:
            result.ResponseDescription || 'Salary payment initiation failed',
          data: result,
        };
      }

      return {
        success: true,
        message: 'Salary payment initiated successfully',
        data: {
          conversationId: result.ConversationID,
          originatorConversationId: result.OriginatorConversationID,
          responseDescription: result.ResponseDescription,
        },
      };
    } catch (error) {
      console.error('B2C Salary payment controller error:', error);
      return {
        success: false,
        message: 'An error occurred while processing salary payment',
        error: error.message,
      };
    }
  }

  @Post('b2c/business')
  @UseGuards(AuthGuardService)
  async initiateBusinessPayment(
    @Body() paymentData: B2CDto,
    @Req() req: Request,
  ) {
    try {
      const userId = (req as any).user.id;
      const result = await this.paymentService.b2cBusinessPayment(
        paymentData,
        userId,
      );

      if (!result) {
        return {
          success: false,
          message:
            'Business payment initiation failed - no response from M-Pesa',
        };
      }

      if ('errorCode' in result) {
        return {
          success: false,
          message: 'Business payment initiation failed',
          error: {
            code: result.errorCode,
            message: result.errorMessage,
          },
        };
      }

      if (result.ResponseCode !== '0') {
        return {
          success: false,
          message:
            result.ResponseDescription || 'Business payment initiation failed',
          data: result,
        };
      }

      return {
        success: true,
        message: 'Business payment initiated successfully',
        data: {
          conversationId: result.ConversationID,
          originatorConversationId: result.OriginatorConversationID,
          responseDescription: result.ResponseDescription,
        },
      };
    } catch (error) {
      console.error('B2C Business payment controller error:', error);
      return {
        success: false,
        message: 'An error occurred while processing business payment',
        error: error.message,
      };
    }
  }

  @Post('b2c-result')
  async handleB2CResult(@Body() resultData: any) {
    try {
      this.logger.log('--- M-PESA B2C RESULT CALLBACK RECEIVED ---');
    this.logger.log(JSON.stringify(resultData, null, 2));
      const processedResult =
        await this.paymentService.processB2CResult(resultData);

      console.log('Processed B2C result:', processedResult);

      return {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      };
    } catch (error) {
      console.error('B2C result processing error:', error);

      return {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      };
    }
  }

  @Post('b2c-timeout')
  async handleB2CTimeout(@Body() timeoutData: any) {
    try {
      console.log(
        'Received B2C timeout:',
        JSON.stringify(timeoutData, null, 2),
      );

      const processedTimeout =
        await this.paymentService.processB2CTimeout(timeoutData);

      console.log('Processed B2C timeout:', processedTimeout);

      return {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      };
    } catch (error) {
      console.error('B2C timeout processing error:', error);

      return {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      };
    }
  }

  @Get('b2c/status/:conversationId')
  @UseGuards(AuthGuardService)
  async getB2CTransactionStatus(
    @Param('conversationId') conversationId: string,
  ) {
    try {
      const transactionStatus =
        await this.paymentService.getB2CTransactionStatus(conversationId);

      if (!transactionStatus) {
        return {
          success: false,
          message: 'B2C transaction not found',
        };
      }

      return {
        success: true,
        data: transactionStatus,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error retrieving B2C transaction status',
        error: error.message,
      };
    }
  }

  @Get('b2c/history')
  @UseGuards(AuthGuardService)
  async getB2CHistory(
    @Req() req: Request,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('status') status?: string,
  ) {
    try {
      const userId = (req as any).user.id;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      // Validate pagination parameters
      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        return {
          success: false,
          message:
            'Invalid pagination parameters. Page must be >= 1, limit must be 1-100',
        };
      }

      const result = await this.paymentService.getB2CHistory(
        userId,
        pageNum,
        limitNum,
        status,
      );

      return {
        success: true,
        data: result.data,
        pagination: result.pagination,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error retrieving B2C transaction history',
        error: error.message,
      };
    }
  }

  @Get('history')
  @UseGuards(AuthGuardService)
  async getPaymentHistory(
    @Req() req: Request,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('phoneNumber') phoneNumber?: string,
    @Query('status') status?: string,
  ) {
    try {
      const userId = (req as any).user.id;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      console.log(userId)

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        return {
          success: false,
          message:
            'Invalid pagination parameters. Page must be >= 1, limit must be 1-100',
        };
      }

      const result = await this.paymentService.getPaymentHistory(
        userId,
        pageNum,
        limitNum,
        phoneNumber,
        status,
      );

      return {
        success: true,
        data: result.data,
        pagination: result.pagination,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error retrieving payment history',
        error: error.message,
      };
    }
  }

  @Post('transaction-status')
  @UseGuards(AuthGuardService)
  async queryTransactionStatus(
    @Body() body: { transactionId: string },
    @Req() req: Request,
  ) {
    try {
      const userId = (req as any).user.id;
      const result = await this.paymentService.queryTransactionStatus(
        body.transactionId,
        userId,
      );

      if (!result) {
        return {
          success: false,
          message: 'Transaction status query failed',
        };
      }

      return {
        success: true,
        message: 'Transaction status query initiated successfully',
        data: result,
      };
    } catch (error) {
      console.error('Transaction status query error:', error);
      return {
        success: false,
        message: 'An error occurred while querying transaction status',
        error: error.message,
      };
    }
  }

  @Post('account-balance')
  @UseGuards(AuthGuardService)
  async queryAccountBalance(@Req() req: Request) {
    try {
      const userId = (req as any).user.id;
      const result = await this.paymentService.queryAccountBalance(userId);

      if (!result) {
        return {
          success: false,
          message: 'Account balance query failed',
        };
      }

      return {
        success: true,
        message: 'Account balance query initiated successfully',
        data: result,
      };
    } catch (error) {
      console.error('Account balance query error:', error);
      return {
        success: false,
        message: 'An error occurred while querying account balance',
        error: error.message,
      };
    }
  }

  // Result endpoints for status and balance queries
  @Post('b2c-result/status')
  async handleTransactionStatusResult(@Body() resultData: any) {
    try {
      console.log(
        'Received transaction status result:',
        JSON.stringify(resultData, null, 2),
      );

      // Store the result in TransactionStatusQuery model if needed
      // This is optional - you can implement based on your requirements

      return {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      };
    } catch (error) {
      console.error('Transaction status result processing error:', error);
      return {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      };
    }
  }

  @Post('b2c-timeout/status')
  async handleTransactionStatusTimeout(@Body() timeoutData: any) {
    try {
      console.log(
        'Received transaction status timeout:',
        JSON.stringify(timeoutData, null, 2),
      );

      return {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      };
    } catch (error) {
      console.error('Transaction status timeout processing error:', error);
      return {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      };
    }
  }

  @Post('b2c-result/balance')
  async handleAccountBalanceResult(@Body() resultData: any) {
    try {
      console.log(
        'Received account balance result:',
        JSON.stringify(resultData, null, 2),
      );

      return {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      };
    } catch (error) {
      console.error('Account balance result processing error:', error);
      return {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      };
    }
  }

  @Post('b2c-timeout/balance')
  async handleAccountBalanceTimeout(@Body() timeoutData: any) {
    try {
      console.log(
        'Received account balance timeout:',
        JSON.stringify(timeoutData, null, 2),
      );

      return {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      };
    } catch (error) {
      console.error('Account balance timeout processing error:', error);
      return {
        ResultCode: 0,
        ResultDesc: 'Accepted',
      };
    }
  }
}
