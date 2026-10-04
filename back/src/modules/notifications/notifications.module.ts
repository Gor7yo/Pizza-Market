import { Module } from '@nestjs/common';
import { EmailNotificationChannel } from './email.channel';
import { NOTIFICATION_CHANNELS, type NotificationChannel } from './notification.types';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [
    EmailNotificationChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      inject: [EmailNotificationChannel],
      // future: PushNotificationChannel, SmsNotificationChannel
      useFactory: (email: EmailNotificationChannel): NotificationChannel[] => [email],
    },
    NotificationsService,
  ],
})
export class NotificationsModule {}
