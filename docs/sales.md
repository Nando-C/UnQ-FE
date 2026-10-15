# The sales page

How a shop's payments become a report a manager can act on: the questions the page answers, the chart that answers each, the rules every number follows, the sentences the page writes, and the demo data that makes the charts worth looking at. The page is the **Sales** tab on a shop's pages (`/shop/:shopId/sales`); its controls and sections are described word for word in [manager-tools.md](./manager-tools.md#sales), and why it is built the way it is in [ux-decisions.md](./ux-decisions.md).

<img src="./images/sales.png" alt="The Sales tab on a desktop: the period controls, the headline figures with their change on the period before, and the trend of net sales with a dashed line for the period before and a 7-day average" width="720">

## One answer, every chart

The page makes one request, `GET /shops/:shopId/sales` with a period, a grouping and `compare=previous`, and draws everything from the answer: the totals, a zero-filled series with every measure the trend can switch to, the weekday × hour cells, the items, the refunds by cause and hour, the tables, and the same again for the period before. A new metric is a client change; a new period is one request. The page derives only ratios of figures the API gave (an average order, a refund rate, a returning share) and a 7-day average that is a reading aid, never a reported number. The API's side is in [UnQ-BE's api.md](https://github.com/Nando-C/UnQ-BE/blob/main/docs/api.md#sales-report).

## The questions

| A manager asks | The page answers with |
| --- | --- |
| How are we doing, and is it getting better? | The headline figures with their change on the period before, and the trend chart: the period before as a dashed line (by day, where the buckets line up), the 7-day average, the peak annotated. |
| When do we sell? | The weekday × hour heatmap, orders or sales, from the first hour with a sale to the last. |
| What sells, and what carries the revenue? | The Pareto of dishes by revenue with the "n make 80%" marker, and the units-against-price scatter that sorts the menu into stars, workhorses, puzzles and sleepers. |
| What are we giving back, and why? | Refunds by cause with count and amount, refunds by the hour they were made, and the refund rate as a trend metric. |
| Do people come back? | New against returning diners per bucket, the returning share, visits per diner. |
| Which tables earn, and how do people pay? | Each table's orders, visits, net and takings per visit; PayPal against card over time. |
| What should I do about it? | The highlights: up to six sentences from the same answer, each a link to its chart. |

## The counting rules

The rules are the API's, decided when the orders were designed and stated in [UnQ-BE's decisions.md](https://github.com/Nando-C/UnQ-BE/blob/main/docs/decisions.md#2026-10-12-sales-are-counted-as-at-a-till-in-the-shops-own-day); the page repeats them in its "How these are counted" note. Days are the shop's own, in its time zone (set in the shop editor, `Europe/London` unless set); weeks start on Monday. Gross is completed payments by the day paid; a payment the provider still holds is counted apart as awaiting, a failed one not at all. Refunds count on the day they were made, whenever the sale was, as at a till; net is gross less refunds. Orders are completed payments, visits distinct carts, diners distinct payers, never named; a returning diner had paid at the shop before the period began. Items count units sold less units refunded, at the price each sold for, under the name diners saw.

## The highlights

The highlights are rules, not a model (`src/lib/findings.ts`): each answers one question from the report, is silent when it has too little to draw on, and is tested sentence for sentence. In order, at most six:

| Rule | Says | Silent when |
| --- | --- | --- |
| The biggest mover | "Net sales are up 25.0% on the period before." (net sales, orders, average order or diners, whichever moved most) | No comparison, or nothing moved 10% or more |
| The busiest day | "Saturday brings 30% of a typical week's sales; the busiest hour is 13:00–14:00." (each weekday taken as its average day, so a range that isn't whole weeks doesn't favour the weekdays it has one more of) | Under a week, or no sales |
| The menu | "Sea Bass alone is 54% of revenue." from a fifth of revenue, else "5 of 6 dishes make 80% of revenue." | One dish, or no revenue |
| Refunds | "“Long wait” is the most common refund cause, 3 of 5 (£36.00), most of them 13:00–14:00." (the hour when it has 40% of them; a sum when no cause was recorded) | Under three refunds |
| Returning diners | "50% of diners had been before, up 10.0 points on the period before." | Under ten diners |
| The top table | "Window took 60% of net sales." ("A table since deleted" when it was) | One table, or no net sales |
| Pending payments | "2 payments still await the provider and aren't counted." | None pending |

## The demo's patterns

Flat data makes flat charts, so the demo seed (`npm run seed:demo` in UnQ-BE) draws its ninety days with the shapes a real venue has, all from a seeded random generator so a rerun writes the same records. Two thirds of visits start in a peak (the café's 8–10 and 12–14, the restaurant's 12–14 and 18–21); the café grows 35% over its ninety days and the restaurant 20%; the café has one bad week, five weeks back, at half the visits; forty diners, of whom a dozen regulars bring seven visits in ten; a dish, the Pastel de Nata, launched 48 days ago; refunds on 4% of visits, 10% on a Friday or Saturday evening and 14% in the bad week, when they are mostly for the wait; six payments in ten by card. The highlights on the demo's café read straight off these.

## The export and the time zone

"Download CSV" offers the period's orders, items and days as files from `GET /shops/:shopId/sales/export`, fetched through the app's API client like every request and saved under the name the API gives; the API names the file and guards it against formulas, and no diner is named or identified in any of them. The shop's time zone is a select in the shop editor from the browser's list of IANA names, the browser's own zone preselected for a new shop.

## What is tested

The day arithmetic across month ends and the clock change in the shop's zone, the presets and stepping, the URL state; the ratios, the moving average and the changes; the page's states; every finding's sentence and silence; and each section's hidden table (`src/tests/sales.test.tsx`, `src/tests/salesBreakdowns.test.tsx`). The API's own tests assert every figure of a fixture built around a clock change, a refund in a later period, a pending payment, a deleted table, a renamed dish and a diner who paid before the range.
