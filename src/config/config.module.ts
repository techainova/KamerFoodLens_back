import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),

        DATABASE_URL: Joi.string().required(),
        MONGODB_URI: Joi.string().required(),
        REDIS_URL: Joi.string().required(),

        JWT_PRIVATE_KEY: Joi.string().required(),
        JWT_PUBLIC_KEY: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

        ENCRYPTION_KEY: Joi.string().length(64).required(),

        AI_SERVICE_URL: Joi.string().uri().required(),

        SMTP_HOST: Joi.string().required(),
        SMTP_PORT: Joi.number().default(587),
        SMTP_USER: Joi.string().required(),
        SMTP_PASS: Joi.string().required(),
        SMTP_FROM: Joi.string().required(),

        CINETPAY_API_KEY: Joi.string().allow('').optional(),
        CINETPAY_SITE_ID: Joi.string().allow('').optional(),

        STRIPE_SECRET_KEY: Joi.string().allow('').optional(),
        STRIPE_WEBHOOK_SECRET: Joi.string().allow('').optional(),

        AWS_ACCESS_KEY_ID: Joi.string().allow('').optional(),
        AWS_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
        AWS_S3_BUCKET: Joi.string().allow('').optional(),
        AWS_REGION: Joi.string().default('eu-west-3'),
        AWS_ENDPOINT: Joi.string().allow('').optional(),

        ALLOWED_ORIGINS: Joi.string().required(),

        FCM_SERVER_KEY: Joi.string().allow('').optional(),

        GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
        GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
        GOOGLE_CALLBACK_URL: Joi.string().allow('').optional(),
        GOOGLE_WEB_CLIENT_ID: Joi.string().allow('').optional(),
        GOOGLE_ANDROID_CLIENT_ID: Joi.string().allow('').optional(),
        GOOGLE_IOS_CLIENT_ID: Joi.string().allow('').optional(),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
  ],
})
export class ConfigModule {}
