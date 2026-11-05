> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Data updates

> How often Crustdata refreshes its person, company, job, social post and technographics data, how to check the age of any record, and how to get data retrieved from the web at request time.

Crustdata refreshes every indexed person and company profile at least once every 30 days, and the most active profiles as often as every day. Each record carries an `updated_at` timestamp showing its last refresh. When you need the current version, the live endpoints retrieve it from the web at the moment you call them.

## Two ways to get data

| | Indexed database | Live retrieval |
| - | - | - |
| How current | Refreshed every 1 to 30 days | Retrieved from the web at request time |
| Person endpoints | People Search, Person Enrichment | Person Live Search, Person Live Enrich |
| Company endpoints | Company Search, Company Enrichment | Company Live Search |
| Job endpoints | Job Postings Search API | Job Live Search, by company |
| Social post endpoints | Social Post Search | Live keyword search, and recent posts for one person or company |
| Batch size | Up to 10,000 people or companies per job, or the job postings of up to 10 companies | Up to 300 profiles per enrich job, 1,000 records per search job |
| Default rate limit | 15 to 30 requests per minute, by endpoint | 10 requests per minute, or 5 for batch jobs |
| Availability | All plans. Batch jobs need an enterprise plan | Enterprise plans or the live add-on |

Live endpoints return the same profile fields as the indexed database. They take a different request format and fewer filters, so use the indexed database for searches with many conditions.

## Update cadence by dataset

| Dataset | How often it is refreshed |
| - | - |
| Person profiles | Every 1 to 30 days |
| Company profiles | Every 1 to 30 days |
| Job postings | Every 1 to 30 days |
| Social posts | Every 1 to 45 days |
| Technographics | Every 1 to 30 days |

## Checking a record's age

Read the timestamp in the table above before you act on a record. On a job posting, `date_added` is the day the listing was posted and `date_updated` is the day Crustdata last refreshed it. If a record is older than your workflow allows, call the live endpoint for that one record.

## Job-change signals

People Search can filter on `recently_changed_jobs`. The flag marks people whose previous role ended within 90 days of the last index rebuild. To find people who started a new role in a specific window, filter `experience.employment_details.current.start_date` on a date range.

## When you need the latest version

| Option | What it does | Use it for |
| - | - | - |
| Live endpoints | Retrieve one person, company or company's job postings from the web at request time | Your highest-priority records |
| Watchers | Re-check a list of people or companies, or re-run a saved search, on a schedule and send only what changed | Job-change, funding and hiring alerts. Person Entity Watchers can keep tracked data 30, 14, 7, 3 or 1 days fresh. Alerts go to a webhook, Slack or email |
| `verified: true` on [Contact Enrichment](https://docs.crustdata.com/person-docs/contact/enrich.md) | Re-checks cached business emails at request time and drops any address that fails a deliverability check | Cutting bounces before a send |

## API versions and changes

Every request carries an `x-api-version` header, currently `2025-11-01`. Pin it so your integration stays on the version you tested. New fields, endpoints and fixes are listed in the [Changelog](https://docs.crustdata.com/openapi-specs/2025-11-01/changelog.md).

## Related pages

* [Person Enrichment API](https://docs.crustdata.com/person-docs/enrichment/introduction.md)
* [Pricing](https://docs.crustdata.com/general/pricing.md) - cost of indexed and live endpoints, and of each watcher refresh level
* [Rate limits](https://docs.crustdata.com/general/rate-limits.md)


## Related topics

- [Capabilities](https://docs.crustdata.com/general/capabilities.md)
- [Data Export](https://docs.crustdata.com/export-docs/data-export.md)
- [Update an entity watch](https://docs.crustdata.com/api-reference/watch-apis/edit-the-watched-list-pause-or-reconfigure-an-entity-watch.md)
- [Person Enrichment API](https://docs.crustdata.com/person-docs/enrichment/introduction.md)
- [Update a discovery watch](https://docs.crustdata.com/api-reference/watch-apis/pause-resume-or-reconfigure-a-discovery-watch.md)
