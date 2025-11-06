import { Injectable, Logger } from '@nestjs/common';
import { createPublicKey, publicEncrypt, constants } from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MpesaSecurityService {
  private readonly logger = new Logger(MpesaSecurityService.name);
  private readonly publicKey: string;
  private readonly initiatorPassword: string;

  constructor(private configService: ConfigService) {
    const publicCert = this.configService.get<string>('MPESA_PUBLIC_CERT');
    const initiatorPass = this.configService.get<string>(
      'MPESA_INITIATOR_PASSWORD',
    );

    if (!publicCert) {
      this.logger.error('MPESA_PUBLIC_CERT is not configured in environment');
      throw new Error(
        'MPESA_PUBLIC_CERT is required but not found in environment variables',
      );
    }

    if (!initiatorPass) {
      this.logger.error(
        'MPESA_INITIATOR_PASSWORD is not configured in environment',
      );
      throw new Error(
        'MPESA_INITIATOR_PASSWORD is required but not found in environment variables',
      );
    }

    this.publicKey = publicCert;
    this.initiatorPassword = initiatorPass;

    this.logger.log('MpesaSecurityService initialized successfully');
  }

  generateSecurityCredential(password?: string): string {
    try {
      const passwordToEncrypt = password || this.initiatorPassword;

      if (!passwordToEncrypt) {
        throw new Error('Initiator password is not configured');
      }

      if (!this.publicKey) {
        throw new Error('M-Pesa public certificate is not configured');
      }

      const publicKeyObj = createPublicKey({
        key: this.publicKey,
        format: 'pem',
      });

      const encrypted = publicEncrypt(
        {
          key: publicKeyObj,
          padding: constants.RSA_PKCS1_PADDING,
        },
        Buffer.from(passwordToEncrypt),
      );

      const securityCredential = encrypted.toString('base64');

      this.logger.log('Security credential generated successfully');

      return securityCredential;
    } catch (error) {
      this.logger.error('Error generating security credential:', error);
      throw new Error(
        `Failed to generate security credential: ${error.message}`,
      );
    }
  }

  getInitiatorPassword(): string {
    return this.initiatorPassword;
  }
}