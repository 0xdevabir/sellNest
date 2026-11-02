# API

Base path `/api/v1`. The generated OpenAPI reference is at `/api/docs` outside production, with request and response shapes. Set `ENABLE_API_DOCS=true` to serve it in production.

**Authentication:** the `sn_session` HttpOnly cookie, set by `POST /auth/login`. Mutating requests with a session need an allowed `Origin` header.

**Errors:**

```json
{ "error": { "code": "RATE_LIMITED", "message": "Too many requests. Wait a moment and try again.", "requestId": "..." } }
```

Common statuses: 400 validation, 401 sign-in needed, 403 not allowed, 404 not found or hidden, 409 state conflict, 429 rate limited.

## Routes

| Area | Routes |
| --- | --- |
| Health | `GET /health/live`, `GET /health/ready` |
| Auth | `POST /auth/register`, `login`, `logout`, `verify-email`, `resend-verification`, `forgot-password`, `reset-password`, `change-password`; `GET /auth/me` |
| Catalog | `GET /categories`, `/categories/popular`, `/locations`, `/locations/nearby`, `/communities`, `/config` |
| Search | `GET /search`, `/search/suggestions`, `/listings` |
| Listings | `POST /listings`; `GET`, `PATCH`, `DELETE /listings/:id`; `GET /listings/:id/edit`, `/listings/:id/buyers`; `POST /listings/:id/publish`, `mark-sold`, `status`, `view`; `POST`, `DELETE /listings/:id/favorite` |
| Uploads | `POST /uploads/images`, `DELETE /uploads/images/:id` |
| Offers | `POST /listings/:id/offers`; `GET /offers`, `/offers/:id`; `POST /offers/:id/accept`, `reject`, `cancel`, `counter` |
| Messaging | `POST`, `GET /conversations`; `GET /conversations/:id`; `GET`, `POST /conversations/:id/messages`; `POST /conversations/:id/read` |
| Notifications | `GET /notifications`; `POST /notifications/read-all`, `/notifications/:id/read` |
| Users | `PATCH /me`; `GET /me/listings`, `/me/favorites`, `/me/blocks`, `/me/pending-reviews`; `GET /users/:username`, `/users/:username/reviews`; `POST`, `DELETE /users/:id/block` |
| Trust | `POST /reports`, `POST /reviews` |
| Admin (staff only) | `GET /admin/overview`, `users`, `listings`, `reports`, `categories`, `locations`, `settings`, `audit`; `PATCH /admin/users/:id`; `POST /admin/listings/:id/moderate`, `/admin/reports/:id/resolve`, `/admin/categories`, `/admin/locations`; `PUT /admin/categories/:id`, `/admin/locations/:id`, `/admin/settings` |

## Realtime

Socket.IO at `/socket.io`, authenticated by the session cookie. Server-to-client events only: `message:new`, `conversation:read`, `notification:new`.
