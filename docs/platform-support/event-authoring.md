# Editing captured events

Events use native content files and shared templates. The builder keeps their public event fields in `event` frontmatter. Calendar files, event schema and supported visible date elements rebuild from these fields without WordPress or AI.

## Dates and time zones

For a timed event, edit `start` and `end` as local wall times:

```yaml
event:
  all_day: false
  start: '2028-01-08 10:00:00'
  end: '2028-01-08 12:00:00'
  timezone: America/New_York
```

Retain the other captured event fields. The build compares the edited fields with the saved capture and derives UTC times. Changing UTC fields instead updates the local display time. Changing the timezone while retaining local times preserves those wall times and recalculates UTC. Normalized values control output; builds do not rewrite the authored Markdown.

A time inside a daylight-saving gap is rejected. An ambiguous repeated time requires an explicitly matching `utc_start` or `utc_end`. Conflicting local and UTC edits are rejected. IANA timezones and fixed offsets such as `UTC+05:45` are supported. New events can omit UTC values when their local times and timezone identify an unambiguous instant.

All-day events retain local calendar dates. ICS uses an exclusive end date; visible content and schema retain the authored inclusive date range.

## Presentation and archives

The adapter recognizes published event date markup and infers supported formats from the saved source, including punctuation, date order, month/weekday language and time convention. It updates nested date tags without flattening their markup. It preserves the source layout when dates have not changed.

Bound month-grouped archives sort events in the captured direction, rebuild month headings, and paginate new records using the shared card template. Editing unrelated metadata does not replace event times with publication dates. A one-page archive without a source pagination component does not gain a redundant pagination row.

Adding an event through an existing shared template uses a matching captured date-format baseline. Archive schema follows known visible native event records, including newly added records and pagination. Source linked schema identities are retained where matched.

## Current limits

- Switching between timed and all-day layouts, or between single-day and multi-day detail layouts, produces a presentation-review issue. The adapter does not yet select every source layout variant automatically.
- Unknown date formats or missing format baselines are reported. Unsupported visible labels retain source text rather than receiving an invented format.
- Recurrence is not inferred. Only captured or explicitly authored occurrences enter feeds.
- Calendar controls and date navigation have scoped fixture coverage. Full event-field and layout coverage remains incomplete; see [plugin status](STATUS.md).
- Unmapped source schema identities remain subject to the SEO preservation advisories. A successful date edit is not proof of complete plugin compatibility.

Tests cover local/UTC edits, DST ambiguity/gaps, fixed offsets, French date labels, nested date tags, added native records, shared templates, month grouping, pagination, feeds and event schema. The installed WordPress/The Events Calendar fixture is tested in a disposable copy; the source site and saved content remain unchanged.

## Calendar timezone

Calendar sites capture the public WordPress site timezone into `kujo-ssg.json`:

```json
"calendar_clock": { "timeZone": "America/New_York" }
```

Edit this value and rebuild to change the calendar controls’ current day. IANA timezone names handle daylight-saving changes. Sites configured with a fixed UTC offset instead use, for example, `"calendar_clock": { "offsetMinutes": 345 }` for UTC+05:45. This setting does not change an event’s own authored timezone or UTC start/end values.

When public site metadata is unavailable, the discovery report records `calendar-timezone-unavailable`; controls fall back to the visitor’s local date. Supply the correct setting to remove that ambiguity. The builder does not infer a site timezone from an event or freeze the captured “today” date.

## Local list pagination

When full source pages establish a consistent page size, date-filtered upcoming event lists use that size locally. Next and previous controls, `calendar-date`/`calendar-page` links and browser history operate on the exported native event records. Changing the date starts at page one. Newly authored events can create additional native archive pages and enter the local calendar without another capture.

The builder needs captured date-heading variants to reproduce ranges and final-page labels. Conflicting source page sizes and missing heading/card templates are reported instead of silently inventing a layout. Past-event views and custom date-format rules are not yet covered by this pagination implementation.
