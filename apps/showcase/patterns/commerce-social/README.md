# Commerce + Social production patterns

This pack stress-tests BeeUI by composing realistic consumer-mobile screens from the public `@beemvp/beeui-ui` API. Domain UI stays local unless repeated evidence shows a generalized platform contract is missing.

## Included screens

Commerce:

1. Product feed — search affordance, category chips, featured product, two-column product collection, populated/loading states.
2. Product search — query, scope chips, filter/sort affordances, result count, result/loading/no-results states.
3. Product detail — media, rating, pricing, variant chips, description, availability, delivery, favorite and add-to-cart callbacks.
4. Cart — product rows, quantity adjustment, remove callback, subtotal/delivery/discount/total and populated/empty states.
5. Checkout — address, delivery method, payment method, summary, terms, place-order callback and normal/processing/problem states.
6. Orders — active/past segmented filtering, status, dates, totals, item counts and empty state.
7. Order detail — status, history timeline, products, shipping/payment details, totals, support and reorder callbacks.

Social:

8. Social feed — composer affordance, author/media post cards, engagement actions and populated/loading/empty states.
9. Post detail — full post, engagement, comments and local comment-entry affordance.
10. Notifications — grouped activity, unread/read treatment, fixture timestamps, select/mark-read callbacks and empty state.
11. User profile — identity, bio, follower metrics, follow/edit callback, metadata and content/empty-content states.
12. Messages — searchable conversation list, unread treatment, timestamps, truncation, selection callback and empty state.

## Composition strategy

The screens intentionally prefer BeeUI foundation and application primitives (`Screen`, `Box`, `Stack`, `Card`, `Button`, `SearchInput`, `ChipGroup`, `RadioGroup`, `SegmentedControl`, `Timeline`, `EmptyState`, `Skeleton`, etc.) over introducing product-specific primitives into the library.

Remote images are fixture-only. Product media uses a local `ProductImage` wrapper with an explicit aspect ratio and an in-layout fallback when a URI fails. Social media uses React Native core `Image`; layout remains useful when media is absent because post copy and actions do not depend on image dimensions.

## Fixture shapes

`commerce-fixtures.ts` defines `Product`, `CartItem`, and `Order` data with explicit display strings for availability, shipping, order dates, and history timestamps. `social-fixtures.ts` defines users, posts, comments, notifications, and conversations. Screens own no backend, router, payment SDK, address API, or networking behavior.

## Domain-local components

The following are deliberately local because they encode commerce/social presentation rather than a proven general BeeUI contract:

- `ProductCard`
- `ProductImage`
- `PriceRow`
- `RatingSummary`
- `QuantityControl`
- `CartRow`
- `CheckoutSection`
- `PostCard`
- `SocialStat`
- `MessageRow`

`QuantityControl` is used by Cart only in this pack, so there is not yet two-screen evidence for a generalized numeric stepper. Product grid wrapping appears in Feed and Search, but the current `Box` flex-wrap composition remains small, responsive, and sufficient; no responsive-grid gap is justified yet.

## State coverage

Representative states are exposed by props so tests and visual QA can render them deterministically:

- Product Feed: populated / loading
- Product Search: results / loading / no results
- Cart: populated / empty
- Checkout: normal / processing / problem
- Orders: active/past / empty
- Social Feed: populated / loading / empty
- Notifications: unread-read mixture / empty
- User Profile: content / empty content
- Messages: active / empty / no search matches

## Reusable gaps discovered

No issue is opened by this pack. The strongest candidates observed were a generalized numeric stepper and a responsive grid, but the current evidence does not make the local workarounds insufficient. Sheet, Select, Carousel/media gallery, RatingInput, and other hypothetical primitives are not implemented here.

## Deferred work

- Chat conversation screen: phase 2; the required conversation-list screen is complete.
- Carousel/media gallery: product detail uses one stable media composition.
- Sheet: filters remain chips + explicit filter callback; no Sheet implementation is introduced.
- Select: variant, delivery, and payment choices use ChipGroup/RadioGroup.
- Backend/router/payment/address/network ownership: callback boundaries only.

## Verification focus

Visual QA should exercise 360×800, 390×844, 430px mobile and wide web in both light and dark themes. Pay particular attention to image ratios, long names, price hierarchy, cart row wrapping, CTA density, usernames, notification density, message truncation, and empty states.
