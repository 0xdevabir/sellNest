import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

export const userRoom = (id: string) => `user:${id}`;
export const sessionRoom = (id: string) => `session:${id}`;

/** Lets feature modules push events without depending on the gateway. */
@Injectable()
export class RealtimeService {
  private server?: Server;

  attach(server: Server) {
    this.server = server;
  }

  toUser(userId: string, event: string, payload: unknown) {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }

  disconnectSession(sessionId: string) {
    this.server?.in(sessionRoom(sessionId)).disconnectSockets(true);
  }

  disconnectUser(userId: string) {
    this.server?.in(userRoom(userId)).disconnectSockets(true);
  }
}
