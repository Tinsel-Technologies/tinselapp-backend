import { Body, Controller, Post, Get, Param } from '@nestjs/common';
import { PaymentService, PaymentDto } from './payment.service';
import { MpesaCallbackDto } from './dto/callback.dto';

@Controller('api/v1/pay')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('mpesa')
  async initiatePayment(@Body() paymentData: PaymentDto) {
    try {
      const result = await this.paymentService.mpesaPayment(paymentData);

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
}
