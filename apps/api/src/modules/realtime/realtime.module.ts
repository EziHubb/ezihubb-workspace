import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PresenceService } from './presence.service';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Live messages and presence.
 *
 * Global so MessagesService can emit without MessagesModule importing this and
 * this importing MessagesModule back — the gateway deliberately knows nothing
 * about messages beyond "relay this object", which is what keeps the cycle
 * from existing in the first place.
 *
 * No controller: presence is answered over the socket that also pushes it, so
 * an HTTP twin would be a second copy of the same authorisation rule and a
 * second surface to keep in step.
 *
 * JwtModule is registered bare: the secret is passed per verify() call from
 * config, so there is no second place for it to drift from the HTTP strategy's.
 */
@Global()
@Module({
  imports:     [JwtModule.register({})],
  providers:   [RealtimeGateway, PresenceService],
  exports:     [RealtimeGateway, PresenceService],
})
export class RealtimeModule {}
