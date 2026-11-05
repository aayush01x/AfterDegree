> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Person Search reference

> Reference for Person Search: filter operators, searchable fields, response fields, request parameters, preview mode, and errors.

This page is the reference for [Person Search](https://docs.crustdata.com/person-docs/search/introduction.md). It lists:

* The filter operators.
* The searchable fields, with a flag that shows if you can sort on each field.
* The response fields.
* The request parameters.
* Preview mode.
* The error responses.

For examples, see [Person Search](https://docs.crustdata.com/person-docs/search/introduction.md) and its
[example requests](https://docs.crustdata.com/person-docs/search/introduction.md#example-requests).

> [!NOTE]
>
> Pricing: Search costs `0.03` credits per result. A premium group adds a
> per-result charge when you filter on it, and another when you receive it,
> so a group that you filter on and receive bills twice. These are the
> premium groups in the tables below:
>
> * `experience`
> * `education`
> * `skills`
> * `certifications`
> * `honors`
> * The `professional_network` signals, with `languages` and `summary`
> * The filter-only `dev_platform_profiles` fields
>
> For the prices, see [Premium fields in search](https://docs.crustdata.com/general/pricing.md#premium-fields-in-search).
> For your own prices, see [`/account/endpoints`](https://docs.crustdata.com/general/permissions).

***

## Filter operator reference

Person Search accepts the following `filters.type` operators.

| Operator | Value shape | Meaning | Example use | |
| - | - | - | - | - |
| `=` | scalar | Exact match against the whole stored value. A phrase match on [free-text fields](#free-text-fields-match-a-phrase) | `basic_profile.name` = "David Hsu" | |
| `!=` | scalar | Not equal | Exclude a specific country | |
| `<` | scalar (number or date string) | Less than | Profiles updated before a timestamp | |
| `=<` | scalar (number or date string) | Less than or equal | `professional_network.connections` at or below a threshold | |
| `>` | scalar (number or date string) | Greater than | `years_of_experience_raw` above a threshold | |
| `=>` | scalar (number or date string) | Greater than or equal | `professional_network.followers` at or above a threshold | |
| `in` | array | Whole stored value is in the list. A phrase match on [free-text fields](#free-text-fields-match-a-phrase) | `experience.employment_details.company_name` in \["Retool", "OpenAI"] | |
| `not_in` | array | Value is not in list | Exclude titles like "Intern" | |
| `is_null` | `null` | Field has no value (see [null checks](#null-checks-is_null-and-is_not_null)) | People with no current employment | |
| `is_not_null` | `null` | Field has at least one non-null value | People with at least one past role | |
| `has_all` | array | Some nested-array element matches each listed value. Different elements can match different values (see [Nested-array matching](#nested-array-matching-all_of-and-has_all)) | `experience.employment_details.company_id` `has_all` \[629097, 632500] | |
| `(.)` | string | Case-insensitive all-words match. Every word in the value must appear, in any order. It is not a regex. On some fields it also matches close misspellings, so it can return lookalike words (see [Choose a text operator](#choose-a-text-operator)). A \` | \` in the value separates words, so all the words must match (AND, not OR). | `(.)` "Software Engineer" matches "Software Senior Engineer" and "Engineer Software", not ~~"Software Eng"~~ |
| `(!)` | string | Fuzzy negation. Excludes substring matches. | Exclude titles containing "Intern" (see notes below) | |
| `[.]` | string | Case-insensitive exact-phrase match. Words must be contiguous and in order, with no partial words or typos. | `[.]` "Software Engineer" matches "Senior Software Engineer", not ~~"Engineer Software"~~ | |
| `geo_distance` | object | Within radius of a location or explicit coordinate | People within 50 km of San Francisco | |
| `geo_exclude` | object | Outside radius of a location or explicit coordinate | People not within 50 km of San Francisco | |
| `geo_polygon` | object | Inside a polygon of explicit coordinates | People located inside a territory you outline on a map | |

> [!WARNING]
>
> Use `=>` for greater than or equal and `=<` for less than or equal. The
> API does not support `>=` and `<=`.

> [!NOTE]
>
> Each endpoint supports a different set of operators. `/person/search` does
> not support `contains`. Use `(.)` for word matching. Company Search accepts
> `contains`. `has_all` works only on nested-array fields, for example
> `experience.employment_details.*`. On other fields, `has_all` returns `400`.
> To require two values on a flat list field, such as
> `skills.professional_network_skills`, put two `=` conditions in an `and`
> group. The API returns the people whose list holds both values.

### `=`, `!=`, `in`, and `not_in` match the whole stored value

On most fields, these four operators compare your value with the complete
stored value, never with part of it. For example, `"Qorvo"` does not match an
employer stored as `"Qorvo, Inc."`. The index holds both spellings as separate
employers, and both return people. So a filter that looks correct can return
almost no profiles. [Free-text fields](#free-text-fields-match-a-phrase) work
differently.

| Filter on `experience.employment_details.current.company_name` | Profiles |
| - | - |
| `=` `"Qorvo"` | 38 |
| `=` `"Qorvo, Inc."` | 4,146 |
| `(.)` `"Qorvo"` | 5,610 |

`in` and `not_in` apply this rule to each value in the list. So a list of near
misses matches nobody. The API does not ignore a difference in punctuation, a
legal suffix, or a missing word. It does not map one value to another.

All four operators ignore case. `= "qorvo, inc."` and `in ["qorvo, inc."]` each
return the same 4,146 profiles as `= "Qorvo, Inc."`.

You can work around the whole-value rule in two ways:

* If you know only part of the value, filter with `(.)`. `(.) "Qorvo"` matches
  every stored spelling that contains the word.
* Get the stored spelling from
  [Autocomplete](https://docs.crustdata.com/person-docs/autocomplete/introduction.md) first, then filter
  with `=` or `in`. Autocomplete covers `title`, `name`, `company_industries`,
  `seniority_level`, and `function_category` on each of the three employment
  paths. Use it before you filter on any of these fields. Autocomplete takes
  the returned path, not the filter path. For example, get employer names from
  `experience.employment_details.current.name`, then filter on
  `experience.employment_details.current.company_name`. For the five fields
  that hold a value from a fixed list, see
  [Closed value sets](#closed-value-sets).

### Free-text fields match a phrase

The API does not store a whole value for fields that hold free text. On these
fields, the same four operators match a phrase. The words must appear together
and in the same order, anywhere in the text. Case does not matter.

| Operator | Meaning on a free-text field |
| - | - |
| `=` | The text contains the phrase. This is the same match as `[.]` |
| `in` | The text contains at least one of the phrases |
| `!=` | The text does not contain the phrase, or the field is empty |
| `not_in` | The text contains none of the phrases, or the field is empty |

These operators work this way on the following fields:

* `basic_profile.headline` and `basic_profile.summary`
* `experience.employment_details.description`, with its `current` and `past`
  forms
* `education.schools.activities_and_societies`
* `dev_platform_profiles.bio`, `dev_platform_profiles.location`,
  `dev_platform_profiles.company_text`, and
  `dev_platform_profiles.repos.description`
* `research_profiles.designation` and `research_profiles.articles.title`

So `basic_profile.headline = "Owner"` also returns people whose headline is
`Small Business Owner`. You cannot filter for a headline that equals one exact
value.

`has_all` uses the same phrase match on
`experience.employment_details.description`.

On these fields, `in` and `not_in` take at most 1,000 values. A longer list
returns `400`:

```json theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "A free-text filter takes at most 1000 values",
        "metadata": []
    }
}
```

### Choose a text operator

Pick the operator by how exact the match needs to be.

| You want to match | Use |
| - | - |
| A known stored value, such as a country, an industry, or a company name | `=` or `in`, with values from [Autocomplete](https://docs.crustdata.com/person-docs/autocomplete/introduction.md) |
| A word or phrase inside the value, exactly as written | `[.]` |
| Keywords where a near miss is acceptable | `(.)` |

`(.)` is the loosest text operator. Every word must appear, in any order, and on
some fields close misspellings also match. So it can return lookalike words. For
example, `(.) "Austria"` on `basic_profile.location.country` also returns people
in Australia. Do not use `(.)` when a near miss would be a wrong result. `[.]`,
`=`, and `in` never match misspellings.

### `(!)`: fuzzy negation

`(!)` excludes profiles whose value contains the substring that you send. The
match ignores case. `(!)` is the opposite of `(.)`. The API matches a
multi-word value as a literal phrase. It does not split the value into words:

* `{ "type": "(!)", "value": "New York" }` excludes only profiles that contain
  the literal phrase `"New York"`. This filter does not exclude a profile whose
  location is `"New Yorker"`. It excludes `"New York City"`, because that value
  contains the full phrase.
* To exclude each word on its own, put one `(!)` condition for each word in an
  `and` group:

  ```json theme={"theme":"vitesse-black"}
  {
      "op": "and",
      "conditions": [
          {
              "field": "basic_profile.headline",
              "type": "(!)",
              "value": "Intern"
          },
          {
              "field": "basic_profile.headline",
              "type": "(!)",
              "value": "Student"
          }
      ]
  }
  ```

### `geo_distance`: radius around a point

Set the center of the radius with one of these fields:

* `location`: A string. The server geocodes it, for example `"San Francisco, CA"`.
* `lat_lng`: Explicit coordinates as `[lat, lng]`. This skips geocoding.

If you send both, the API uses `lat_lng`. `distance` is required. `unit`
defaults to `km`.

| Field | Type | Required | Notes |
| - | - | - | - |
| `location` | string | Yes, or `lat_lng` | The server geocodes it. The API ignores it when you also send `lat_lng`. |
| `lat_lng` | number\[] | Yes, or `location` | A two-element `[lat, lng]` array. Lat must be in `[-90, 90]`. Lng must be in `[-180, 180]`. |
| `distance` | number | Yes | The radius around the center. It must be positive. |
| `unit` | string | No | One of `km`, `mi`, `miles`, `m`, `meters`, `ft`, `feet`. The default is `km`. |

For full requests that use `location` and `lat_lng`, see
[`geo_distance` examples](https://docs.crustdata.com/person-docs/search/introduction#search-within-a-geographic-radius).

### `geo_exclude`: exclude a radius

`geo_exclude` is the inverse of `geo_distance`. It removes profiles inside the
radius and keeps everyone else. It takes the same value object: `location` or
`lat_lng`, a required `distance`, and an optional `unit` (default `km`). It
works on the same location fields. Use it to remove a metro area that you
already cover. You can also use it to find candidates outside a region.

```json theme={"theme":"vitesse-black"}
{
    "field": "professional_network.location.raw",
    "type": "geo_exclude",
    "value": { "location": "San Francisco", "distance": 50, "unit": "km" }
}
```

For a full request, see
[`geo_exclude` examples](https://docs.crustdata.com/person-docs/search/introduction#exclude-a-geographic-radius).

### `geo_polygon`: inside a polygon

`geo_polygon` keeps profiles located inside a polygon you draw with explicit
coordinates. Use it when a radius is the wrong shape: a sales territory, a
commute zone, or an area traced on a map. It works on the same location fields
as `geo_distance`.

| Field | Type | Required | Notes |
| - | - | - | - |
| `points` | number\[]\[] | Yes | List of `[lat, lng]` pairs, at least 3 distinct points and at most 1,000. Lat in `[-90, 90]`, lng in `[-180, 180]`. |

The polygon closes itself, so repeating the first point is optional. Edges may
not cross, and no point may be revisited. Points are coordinates, not place
names, and are not geocoded. A polygon that crosses the 180° meridian must
list its points counter-clockwise, or it is read as everything outside it.

```json theme={"theme":"vitesse-black"}
{
    "field": "professional_network.location.raw",
    "type": "geo_polygon",
    "value": { "points": [[37.81, -122.52], [37.81, -122.35], [37.70, -122.35], [37.70, -122.52]] }
}
```

A polygon with fewer than 3 distinct points, a malformed pair, crossing edges,
or an out-of-range coordinate returns `400` with a message naming the problem,
for example `geo_polygon 'points' needs at least 3 distinct points`.

For a full request, see
[`geo_polygon` examples](https://docs.crustdata.com/person-docs/search/introduction#search-inside-a-polygon).

### Null checks: `is_null` and `is_not_null`

Both operators take a literal `null` value. The `value` key is required. A
request without it returns `400`:

```json theme={"theme":"vitesse-black"}
{
    "field": "experience.employment_details.current.name",
    "type": "is_null",
    "value": null
}
```

On nested-array fields, the check applies to each element:

* `is_null` matches profiles where no element has the field, for example an
  empty `experience.employment_details.current` array.
* `is_not_null` matches profiles where at least one element has a non-null
  value.

Combine the two operators to match on which fields a profile has:

> [accordion] Example: people in transition (left a job, no new one yet)
>
> This request finds people with no current employer and at least one past employer:
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         {
>           "field": "experience.employment_details.current.name",
>           "type": "is_null",
>           "value": null
>         },
>         {
>           "field": "experience.employment_details.past.name",
>           "type": "is_not_null",
>           "value": null
>         }
>       ]
>     },
>     "limit": 10
>   }'
> ```
>
> The response has the standard Person Search shape.

> [accordion] Example: only profiles that carry education data
>
> Exclude profiles that do not have a field that your workflow needs. Then later
> steps do not get empty values:
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "education.schools.school",
>       "type": "is_not_null",
>       "value": null
>     },
>     "limit": 10
>   }'
> ```

## Nested-array matching: `all_of` and `has_all`

Some fields are arrays of nested objects. For example, a person's employment
history (`experience.employment_details.*`) is an array. Each entry has its own
`title`, `company_id`, `company_name`, and dates. When you put several
conditions on one of these fields, you can mean one of two things:

* Same element: One array entry meets all the conditions. For example, the
  person was an Engineer at company X, in one job.
* Cross element: Different entries each meet one condition. For example, the
  person was an Engineer at company A and a Manager at company B, in two
  separate jobs.

A plain `and` group on one nested field means same element. All the conditions
must match in one entry. For cross element, use an `all_of` group.

Repositories (`dev_platform_profiles.repos.*`) and research articles
(`research_profiles.articles.*`) are the exception. On these two arrays, each
condition in an `and` group can match a different entry.

### Two conditions on one field

Two conditions on the same nested field in an `and` group ask for one element
that meets both. So two title conditions ask for one job title that contains
every word of both values. They do not ask for a person who held one title and
later the other:

| Filter on `experience.employment_details.title` | Profiles |
| - | - |
| `(.)` `"Test Analyst"` | 191,945 |
| `(.)` `"Test Manager"` | 159,940 |
| Both, in one `and` group | 4,177 |
| Both, in one `or` group | 333,217 |

The 4,177 profiles have a title such as
`"Business Analyst, Test Manager and Project Manager"`. This one title contains
all three words.

Each condition that you add this way makes the set smaller, and the set can
become empty. If you add `(.) "CMO"` to the two conditions above, the search
returns zero profiles. But 118,586 people have `CMO` in a title. A chief
marketing officer is not also a test analyst in the same job.

Pick the group operator that matches what you mean:

* `or` for people who match either title.
* `all_of` for people who held one title in one job and the other in another
  job. See the `all_of` section below.
* `and` for one job that meets every condition.

### `all_of`: each condition matched by some element

`all_of` is a group operator, like `and` and `or`. At least one array element
must meet each condition in it. The API checks each condition on its own, so
different elements can meet different conditions. A condition can be a single
filter or an `and` or `or` group. The API matches a group within one element.

Same element: one job has the title `Engineer` and is at company `629097`:

```json theme={"theme":"vitesse-black"}
{
    "filters": {
        "op": "all_of",
        "conditions": [
            {
                "op": "and",
                "conditions": [
                    {
                        "field": "experience.employment_details.title",
                        "type": "(.)",
                        "value": "Engineer"
                    },
                    {
                        "field": "experience.employment_details.company_id",
                        "type": "=",
                        "value": 629097
                    }
                ]
            }
        ]
    }
}
```

Cross element: `Engineer` at one company and `Manager` at another company, in
different jobs:

```json theme={"theme":"vitesse-black"}
{
    "filters": {
        "op": "all_of",
        "conditions": [
            {
                "op": "and",
                "conditions": [
                    {
                        "field": "experience.employment_details.title",
                        "type": "(.)",
                        "value": "Engineer"
                    },
                    {
                        "field": "experience.employment_details.company_id",
                        "type": "=",
                        "value": 629097
                    }
                ]
            },
            {
                "op": "and",
                "conditions": [
                    {
                        "field": "experience.employment_details.title",
                        "type": "(.)",
                        "value": "Manager"
                    },
                    {
                        "field": "experience.employment_details.company_id",
                        "type": "=",
                        "value": 632500
                    }
                ]
            }
        ]
    }
}
```

You can put `all_of` groups inside `and` and `or` groups. So you can combine
cross-element conditions with document-level filters, such as location. A
document-level filter applies to the whole profile, not to one array element.
Conditions inside `all_of` accept any positive operator: `=`, `(.)`, `[.]`,
`in`, `<`, `>`, `=<`, and `=>`.

### `has_all`: every value matched by some element

`has_all` is a short form for a common cross-element case: a list of values
where some element of the array matches each value.

This filter finds people who worked at both company `629097` and company
`632500`, in two separate roles:

```json theme={"theme":"vitesse-black"}
{
    "filters": {
        "field": "experience.employment_details.company_id",
        "type": "has_all",
        "value": [629097, 632500]
    }
}
```

The API expands this to an `all_of` group with one equality condition for each value:
`{ "op": "all_of", "conditions": [company_id = 629097, company_id = 632500] }`.

### Rules and validation

* Send the operator in lowercase: `all_of`, like `and` and `or`. The API
  rejects `allOf` and other casings.
* All fields in one `all_of` condition, or in its `and` or `or` group, must
  resolve to one nested-array path. The API rejects a group that mixes paths,
  for example an employment field and an education field. Put them in separate
  `all_of` conditions.
* `all_of` and `has_all` work only on nested-array fields: employment,
  education, certifications, honors, repositories, and research articles.
  The API rejects them on a scalar field, such as a name.
* The API also rejects `all_of` and `has_all` on a flat list field. For
  `skills.professional_network_skills`, the `400` message is
  `all_of/has_all conditions require nested array fields; 'skills' is not a nested field`.
  Use two `=` conditions in an `and` group instead.
* Conditions inside `all_of` accept positive operators only. The API rejects
  the negation operators `!=`, `not_in`, `(!)`, and `geo_exclude` there. Apply
  negation at the document level instead.
* Do not put a `has_all` condition or another `all_of` group inside an `all_of`
  group. Expand it into `=` conditions instead.
* `has_all` needs a non-empty list.

## Searchable fields

* Some returned fields use a different filter path. For example, to filter on the returned `basic_profile.current_title`, use `experience.employment_details.current.title`. For the employer paths, see [Filter paths and their returned twins](#filter-paths-and-their-returned-twins).
* `contact.has_business_email` is `true` when a business email for the person is on file. Filter on it with `=` or `!=` and `true` or `false`. Other operators return a `400`. The flag does not promise that [Contact Enrich](https://docs.crustdata.com/person-docs/contact/enrich.md) returns an email: Contact Enrich checks the address, and it can also find one when the flag is `false`. To filter on a verified business email at a role, use `experience.employment_details.current.business_email_verified`, `experience.employment_details.past.business_email_verified`, or `experience.employment_details.business_email_verified`.
* `contact.has_personal_email` and `contact.has_phone_number` are not fields. A filter on either returns a `400`.
* Search results include `social_handles.professional_network_identifier.profile_url`, but the API rejects it as a filter. To look up a person by profile URL, use [Person Enrich](https://docs.crustdata.com/person-docs/enrichment/introduction.md).
* A person can hold several current roles at the same time. Exactly one of them has `experience.employment_details.current.is_default` set. Filter on this field to match people by their primary employer, not by any employer that they list. The `past.` path and the all-roles path work the same way.
* To filter by employer profile ID, use `experience.employment_details.professional_network_id`. To limit the filter to current or past roles, use the `current.` or `past.` path. Get the value from `basic_info.professional_network_id` on [Company Identify](https://docs.crustdata.com/company-docs/identify/introduction.md) or [Company Enrich](https://docs.crustdata.com/company-docs/enrichment/introduction.md), and send it as a string. If you have a Crustdata company ID instead, use `experience.employment_details.company_id`.

> [!NOTE]
>
> Country filters do not all use the same value format. Use full country names
> for person location fields. Employer headquarters country fields accept a
> full country name or an ISO 3166-1 alpha-3 code.

### Country and region value formats

| Field | Value format | Examples |
| - | - | - |
| `basic_profile.location.country` | Full country name | `"United States"`, `"India"` |
| `basic_profile.location.state` | Full state or region name | `"California"`, `"Ontario"` |
| `basic_profile.location.continent` | Full continent name | `"North America"`, `"Asia"` |
| `professional_network.location.raw` | Raw location string | `"San Francisco Bay Area"` |
| `experience.employment_details.company_headquarters_country` | ISO 3166-1 alpha-3 code or full country name | `"USA"`, `"India"` |
| `experience.employment_details.current.company_headquarters_country` | ISO 3166-1 alpha-3 code or full country name | `"USA"`, `"Germany"` |
| `experience.employment_details.past.company_headquarters_country` | ISO 3166-1 alpha-3 code or full country name | `"IND"`, `"United States"` |
| `experience.employment_details.company_hq_location` | Employer HQ location string | `"San Francisco, California"` |

Headquarters country filters accept an ISO 3166-1 alpha-3 code, such as `USA`,
or a full country name, such as `United States`. Both forms return the same
people, and the response returns the full country name. For the full code list,
see the [ISO 3166-1 alpha-3 country code list](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3).
For `basic_profile.location.country`, use [Autocomplete](https://docs.crustdata.com/person-docs/autocomplete/introduction.md)
to find the indexed full country names, then filter with `=` or `in`.

### Website value formats

| Field | Value format | Examples |
| - | - | - |
| `experience.employment_details.current.company_website_domain` | Bare website domain | `"stripe.com"` |
| `experience.employment_details.past.company_website_domain` | Bare website domain | `"stripe.com"` |
| `experience.employment_details.company_website_domain` | Bare website domain | `"stripe.com"` |
| `experience.employment_details.company_website` | Exact stored website URL, with scheme and query | `"http://www.chetnetwork.com"` |

To filter on a website, use the `company_website_domain` fields with a bare
domain and no scheme. The all-roles `company_website` filter matches the stored
URL exactly, including the scheme and any query string. A stored value can look
like `https://example.com?utm_source=profile`. So use the domain fields, unless
you need an exact URL match.

Search responses return the website as a full URL under
`experience.employment_details.current.company_website` or
`past.company_website`. The `company_website_domain` paths are filter names
only. They never appear in the search response.
[Person Enrich](https://docs.crustdata.com/person-docs/enrichment/introduction.md) does the reverse: it
returns the bare domain under `company_website_domain`.

### Employer profile URL values

| Field | Value format | Examples |
| - | - | - |
| `experience.employment_details.current.company_professional_network_profile_url` | Company page URL | `"https://www.linkedin.com/company/stripe"` |
| `experience.employment_details.past.company_professional_network_profile_url` | Company page URL | `"https://www.linkedin.com/company/stripe"` |

The API also accepts the alias `...company_linkedin_profile_url` on both
paths. It matches the same data. You cannot filter on the bare all-employers
path.

These fields match the company page of the employer. You can send the page URL
in any usual form. Search accepts the URL:

* With or without the scheme.
* With or without `www.`.
* With a country subdomain, such as `de.linkedin.com`.
* With a trailing slash.
* With a query string, such as `?trk=...`.
* With a sub-path, such as `/about`.

The case of the slug does not matter. Search converts each of these forms to
the stored form before it matches. So each form returns the same profiles.

A URL that is not a company page matches no profile. So search returns `400`
with the value that you sent. These values return `400`:

* A school page (`/school/...`).
* A person profile (`/in/...`).
* A showcase page (`/showcase/...`).
* A bare slug, such as `"stripe"`.
* `/company/` with no slug after it.

For a school, filter on `education.schools.school`. For one person, use
[Person Enrich](https://docs.crustdata.com/person-docs/enrichment/introduction.md), which takes a profile
URL.

The API accepts an empty value. It matches the employers that have no company
page.

### Boolean syntax in a value

The API matches a filter value literally. A filter value is not a query
language. For example, the API searches for `("development" OR "developer")` as
one whole string. That string matches no profile, so search returns `400`.

Write the `OR` as a group of conditions instead:

```json theme={"theme":"vitesse-black"}
{
    "op": "or",
    "conditions": [
        { "field": "experience.employment_details.current.title", "type": "[.]", "value": "development" },
        { "field": "experience.employment_details.current.title", "type": "[.]", "value": "developer" }
    ]
}
```

The `400` message contains this group, built from your field and operator. You
can copy it into your next request. For an `in` filter, put one term in each
element of the list instead.

This rule is narrow. `OR` and `AND` are ordinary words in stored values. So
`[.] "Head of OR"` and `(.) "Sales And Marketing Specialist"` still match
profiles. Search rejects a value only when the value has one of your own quote
characters next to an uppercase `OR` or `AND`. Search checks values under `=`,
`in`, `has_all`, `(.)`, and `[.]`. These are the operators where a boolean
string matches nothing.

A value that joins its terms with `AND` gets the same `400`, but with no group
to copy. You must decide what the AND means. An `and` group asks one employment
to match every condition. An `all_of` group asks for a different employment for
each condition. See
[Nested-array matching](#nested-array-matching-all_of-and-has_all).

### Closed value sets

Five filter fields hold a value from a fixed list. A value outside the list,
such as `"Founder"`, `"vp"`, or `"1-10"`, matches no profile. So search returns
`400` with the field name and the full list. The API ignores case, but nothing
else. It always rejects a value with a leading or trailing space, and part of a
value, such as `"Vice"`. It never maps one value to another. For example,
`"vp"` stays rejected. It does not become `"Vice President"`.

`=`, `!=`, `in`, and `not_in` ignore case. So `"director"`, `"DIRECTOR"`, and
`["director"]` all match `"Director"`. Copy the values from the table below or
from [Autocomplete](https://docs.crustdata.com/person-docs/autocomplete/introduction.md).

Each employer field in the table applies to all three employment paths:
`experience.employment_details.`, `experience.employment_details.current.`, and
`experience.employment_details.past.`.

| Field | Values |
| - | - |
| `seniority_level` | `"Entry Level"`, `"Entry Level Manager"`, `"Senior"`, `"Director"`, `"Owner / Partner"`, `"CXO"`, `"Vice President"`, `"In Training"`, `"Experienced Manager"`, `"Strategic"` |
| `function_category` | `"Engineering"`, `"Sales"`, `"Consulting"`, `"Marketing"`, `"Operations"`, `"Finance"`, `"Research"`, `"Customer Success and Support"`, `"Arts and Design"`, `"Human Resources"`, `"Legal"`, `"Product Management"` |
| `company_headcount_range` | `"myself only"`, `"2-10"`, `"11-50"`, `"51-200"`, `"201-500"`, `"501-1000"`, `"1001-5000"`, `"5001-10000"`, `"10001+"` |
| `company_status` | `"active"`, `"deleted"` |
| `professional_network.open_to_cards` | `"CAREER_INTEREST"`, `"HIRING_MANAGER"`, `"VOLUNTEERING"`. See [Open-to signal values](#open-to-signal-values) |

These are the near misses that customers send most often:

* `"Founder"` and `"CEO"` are not seniority levels. Those people have the index
  values `"Owner / Partner"` and `"CXO"`.
* `"Manager"` is not a seniority level. The list has `"Entry Level Manager"` and
  `"Experienced Manager"`.
* A full job title is never a seniority level. So the API rejects
  `"Chief Executive Officer"`, `"Chief Financial Officer"`,
  `"Chief Revenue Officer"`, `"Senior Director"`, and `"Managing Director"`.
* The smallest headcount band is the phrase `"myself only"`.
* The band below `"11-50"` is `"2-10"`, not `"1-10"`.
* Bands have no thousands separator. Send `"501-1000"`, never `"501-1,000"`.

The API accepts one value outside the lists: the empty string. The index stores
`""` on `function_category`, `company_headcount_range`, and `company_status`
when the value for the employer is unknown. So `= ""` matches those profiles and
does not return `400`.

You can read the current lists at any time with
[Autocomplete](https://docs.crustdata.com/person-docs/autocomplete/introduction.md).

### Identity & metadata

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `crustdata_person_id` | integer | Yes | Yes | Crustdata person ID |
| `metadata.updated_at` | datetime | Yes | Yes | Last profile update timestamp |
| `metadata.last_scraped_source` | string | Yes | No | Last profile refresh source |

### Basic profile

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `basic_profile.name` | string | Yes | Yes | Full name |
| `basic_profile.first_name` | string | Yes | No | First name |
| `basic_profile.last_name` | string | Yes | No | Last name |
| `basic_profile.headline` | string | Yes | No | Profile headline |
| `basic_profile.summary` | string | Yes | No | Profile summary / about |
| `basic_profile.languages` | string\[] | Yes | No | Spoken languages |
| `basic_profile.last_updated` | datetime | Yes | No | Last update timestamp on the basic profile |
| `basic_profile.location` | string | Yes | Yes | Location summary |
| `basic_profile.location.full_location` | string | Yes | Yes | Full location string |
| `basic_profile.location.city` | string | Yes | Yes | City |
| `basic_profile.location.state` | string | Yes | Yes | State / region as a full name |
| `basic_profile.location.country` | string | Yes | Yes | Country as a full name |
| `basic_profile.location.continent` | string | Yes | No | Continent as a full name |
| `basic_profile.normalized_title.department` | string | Yes | No | [Job Title Normalization](https://docs.crustdata.com/guides/job-title-normalization.md) (beta). High-level department. |
| `basic_profile.normalized_title.sub_department` | string | Yes | No | [Job Title Normalization](https://docs.crustdata.com/guides/job-title-normalization.md) (beta). Sub-department / category. |
| `basic_profile.normalized_title.matched_title` | string | Yes | No | [Job Title Normalization](https://docs.crustdata.com/guides/job-title-normalization.md) (beta). Standardized canonical title. |
| `basic_profile.normalized_title.similarity` | float | No | No | [Job Title Normalization](https://docs.crustdata.com/guides/job-title-normalization.md) (beta). Similarity score between raw and matched title. |
| `basic_profile.normalized_title.confident` | boolean | No | No | [Job Title Normalization](https://docs.crustdata.com/guides/job-title-normalization.md) (beta). Whether the mapping is high-confidence. |
| `basic_profile.professional_network_name` | string | Yes | No | Display name on the professional-network profile |

### Professional network

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `professional_network.location.raw` | string | Yes | No | Raw location string from profile |
| `professional_network.location` | string | Yes | No | Network location summary |
| `professional_network.location.city` | string | Yes | No | Network location city |
| `professional_network.location.state` | string | Yes | No | Network location state / region |
| `professional_network.location.country` | string | Yes | No | Network location country |
| `professional_network.location.continent` | string | Yes | No | Network location continent |
| `professional_network.connections` | integer | Yes | Yes | Connection count |
| `professional_network.followers` | integer | Yes | Yes | Follower count |
| `professional_network.open_to_cards` | string\[] | Yes | No | Open-to signal codes. See [Open-to signal values](#open-to-signal-values) |
| `professional_network.metadata.last_scraped_source` | string | Yes | No | Last profile refresh source |

### Skills

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `skills.professional_network_skills` | string\[] | Yes | No | Listed skills |

### Experience: all employers

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `experience.employment_details.company_name` | string | Yes | No | Company name across all roles |
| `experience.employment_details.title` | string | Yes | No | Job title across all roles |
| `experience.employment_details.description` | string | Yes | No | Role description across all roles |
| `experience.employment_details.seniority_level` | string | Yes | No | Seniority level across all roles |
| `experience.employment_details.function_category` | string | Yes | No | Function category across all roles |
| `experience.employment_details.start_date` | date | Yes | Yes | Role start date across all roles |
| `experience.employment_details.end_date` | date | Yes | No | Role end date across all roles |
| `experience.employment_details.location` | string | Yes | No | Role location across all roles |
| `experience.employment_details.company_id` | integer | Yes | Yes | Company ID across all roles |
| `experience.employment_details.professional_network_id` | string | Yes | No | Employer profile ID across all roles |
| `experience.employment_details.company_website_domain` | string | Yes | No | Employer website domain |
| `experience.employment_details.company_headcount_latest` | integer | Yes | Yes | Employer latest headcount |
| `experience.employment_details.company_headcount_range` | string | Yes | No | Employer headcount range |
| `experience.employment_details.company_industries` | string\[] | Yes | No | Employer industries |
| `experience.employment_details.company_professional_network_industry` | string\[] | Yes | No | Employer industry labels. A filter matches any label, the same as `company_industries` |
| `experience.employment_details.company_type` | string | Yes | No | Employer company type |
| `experience.employment_details.company_status` | string | Yes | No | Employer lifecycle: `"active"`, `"deleted"`, or null |
| `experience.employment_details.company_headquarters_country` | string | Yes | No | Employer HQ country as a full country name. Filter with the name or an ISO 3166-1 alpha-3 code |
| `experience.employment_details.company_hq_location` | string | Yes | No | Employer HQ location string |
| `experience.employment_details.company_website` | string | Yes | No | Employer website across all roles. It matches the stored full URL exactly, with the scheme and any query string. Use `company_website_domain` if you can |
| `experience.employment_details.employment_type` | string | Yes | No | Employment type across all roles |
| `experience.employment_details.is_default` | boolean | Yes | No | Whether the role is the person's primary one |
| `experience.employment_details.years_at_company_raw` | number | Yes | Yes | Whole years in the role, floored. Counts from the role's start date, so a promotion starts it over. For precise tenure, filter `start_date` instead |
| `experience.employment_details.business_email_verified` | boolean | Yes | No | Verified business email across all roles |

### Experience: current employer

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `experience.employment_details.current.company_name` | string | Yes | No | Current company name (filter alias of `current.name`) |
| `experience.employment_details.current.title` | string | Yes | No | Current job title |
| `experience.employment_details.current.description` | string | Yes | No | Current role description |
| `experience.employment_details.current.seniority_level` | string | Yes | No | Current seniority level |
| `experience.employment_details.current.function_category` | string | Yes | No | Current function category |
| `experience.employment_details.current.start_date` | date | Yes | No | Current role start date |
| `experience.employment_details.current.name` | string | Yes | No | Current company name (returned response field) |
| `experience.employment_details.current.years_at_company_raw` | number | Yes | No | Years at current company |
| `experience.employment_details.current.company_headquarters_country` | string | Yes | No | Current employer HQ country as a full country name. Filter with the name or an ISO 3166-1 alpha-3 code |
| `experience.employment_details.current.company_id` | integer | Yes | No | Current employer company ID (filter alias of `current.crustdata_company_id`). The response returns the id under `current.crustdata_company_id`, not `company_id` |
| `experience.employment_details.current.professional_network_id` | string | Yes | No | Current employer profile ID. Returned under the same name on each role, so this one is not an alias. |
| `experience.employment_details.current.position_id` | string | Yes | No | Per-role identifier for the current position (one per role, distinct from company ID) |
| `experience.employment_details.current.is_default` | boolean | Yes | No | Whether this is the person's primary current role. Exactly one current role per profile is the default. |
| `experience.employment_details.current.company_industries` | string\[] | Yes | No | Current employer industries |
| `experience.employment_details.current.company_type` | string | Yes | No | Current employer company type |
| `experience.employment_details.current.company_status` | string | Yes | No | Current employer lifecycle: `"active"`, `"deleted"`, or null |
| `experience.employment_details.current.company_headcount_latest` | integer | Yes | No | Current employer latest headcount |
| `experience.employment_details.current.company_headcount_range` | string | Yes | No | Current employer headcount range |
| `experience.employment_details.current.company_hq_location` | string | Yes | No | Current employer HQ location string |
| `experience.employment_details.current.company_website_domain` | string | Yes | No | Current employer website domain (filter alias of `current.company_website`). Filter with a bare domain, such as `"stripe.com"`. The response returns the full URL under `current.company_website` |
| `experience.employment_details.current.company_professional_network_industry` | string\[] | Yes | No | Current employer industry labels. A filter matches any label, the same as `current.company_industries`. The response returns only the primary label, as a string |
| `experience.employment_details.current.company_professional_network_profile_url` | string | Yes | No | Current employer company page URL. See [Find people at a company](https://docs.crustdata.com/person-docs/search/introduction.md#find-people-at-a-company-by-its-profile-url) |
| `experience.employment_details.current.company_linkedin_profile_url` | string | Yes | No | Current employer profile URL (accepted alias) |
| `experience.employment_details.current.employment_type` | string | Yes | No | Current employment type |
| `experience.employment_details.current.business_email_verified` | boolean | Yes | No | Verified business email on current role |

### Experience: past employer

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `experience.employment_details.past.company_name` | string | Yes | No | Past company name (filter alias of `past.name`) |
| `experience.employment_details.past.title` | string | Yes | No | Past job title |
| `experience.employment_details.past.description` | string | Yes | No | Past role description |
| `experience.employment_details.past.seniority_level` | string | Yes | No | Past seniority level |
| `experience.employment_details.past.function_category` | string | Yes | No | Past function category |
| `experience.employment_details.past.start_date` | date | Yes | No | Past role start date |
| `experience.employment_details.past.name` | string | Yes | No | Past company name (returned response field) |
| `experience.employment_details.past.years_at_company_raw` | number | Yes | No | Years at past company |
| `experience.employment_details.past.company_headquarters_country` | string | Yes | No | Past employer HQ country as a full country name. Filter with the name or an ISO 3166-1 alpha-3 code |
| `experience.employment_details.past.company_id` | integer | Yes | No | Past employer company ID (filter alias of `past.crustdata_company_id`). The response returns the id under `past.crustdata_company_id`, not `company_id` |
| `experience.employment_details.past.professional_network_id` | string | Yes | No | Past employer profile ID. Returned under the same name on each role, so this one is not an alias. |
| `experience.employment_details.past.position_id` | string | Yes | No | Per-role identifier for the past position (one per role, distinct from company ID) |
| `experience.employment_details.past.is_default` | boolean | Yes | No | Whether this is the person's primary past role. Exactly one past role per profile is the default. |
| `experience.employment_details.past.company_industries` | string\[] | Yes | No | Past employer industries |
| `experience.employment_details.past.company_type` | string | Yes | No | Past employer company type |
| `experience.employment_details.past.company_status` | string | Yes | No | Past employer lifecycle: `"active"`, `"deleted"`, or null |
| `experience.employment_details.past.company_headcount_latest` | integer | Yes | No | Past employer latest headcount |
| `experience.employment_details.past.company_headcount_range` | string | Yes | No | Past employer headcount range |
| `experience.employment_details.past.company_hq_location` | string | Yes | No | Past employer HQ location string |
| `experience.employment_details.past.company_website_domain` | string | Yes | No | Past employer website domain (filter alias of `past.company_website`). Filter with a bare domain, such as `"stripe.com"`. The response returns the full URL under `past.company_website` |
| `experience.employment_details.past.company_professional_network_industry` | string\[] | Yes | No | Past employer industry labels. A filter matches any label, the same as `past.company_industries`. The response returns only the primary label, as a string |
| `experience.employment_details.past.company_professional_network_profile_url` | string | Yes | No | Past employer company page URL. See [Find people at a company](https://docs.crustdata.com/person-docs/search/introduction.md#find-people-at-a-company-by-its-profile-url) |
| `experience.employment_details.past.company_linkedin_profile_url` | string | Yes | No | Past employer profile URL (accepted alias) |
| `experience.employment_details.past.employment_type` | string | Yes | No | Past employment type |
| `experience.employment_details.past.business_email_verified` | boolean | Yes | No | Verified business email on past role |

> [!NOTE]
>
> `company_status` is the lifecycle state of the employer in the Crustdata
> entity graph. It is the same value that
> [Company Search](https://docs.crustdata.com/company-docs/search/reference.md) returns as
> `basic_info.status`. Every employment object has it. It has three values:
>
> * `active`: The employer resolves to a live company record.
> * `deleted`: The employer resolves to a company record that Crustdata
>   retired.
> * `null`: Crustdata did not resolve the employer to a company record. Only
>   the free-text company name on the role is available.
>
> You can filter on it on all three employment paths. To match a person by any
> role that they held, use `experience.employment_details.company_status`. To
> check only current or only past roles, use the `current.` or `past.` path. A
> profile matches when any role meets the condition. So `is_null` and
> `is_not_null` both return large sets that overlap. A person with a mix of
> resolved and unresolved employers matches both.

### Education

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `education.schools.school` | string | Yes | No | School name |
| `education.schools.degree` | string | Yes | No | Degree |
| `education.schools.field_of_study` | string | Yes | No | Field of study |
| `education.schools.activities_and_societies` | string | Yes | No | Activities and societies |
| `education.schools.start_year` | integer | Yes | No | Year the person started at the school |
| `education.schools.end_year` | integer | Yes | No | Year the person finished at the school, or expects to finish |
| `education.schools.location` | string | Yes | No | School location summary |
| `education.schools.location.city` | string | Yes | No | School location city |
| `education.schools.location.state` | string | Yes | No | School location state / region |
| `education.schools.location.country` | string | Yes | No | School location country |
| `education.schools.location.continent` | string | Yes | No | School location continent |
| `education.schools.location.full_location` | string | Yes | No | School full location string |

> [!NOTE]
>
> `education.schools.start_year` and `education.schools.end_year` take one
> whole-number year, such as `2024`. The API compares whole years, so `=< 2020`
> and `< 2021` return the same profiles. An `end_year` can be a future year
> when the person lists an expected graduation.
>
> Use `=`, `<`, `=<`, `>`, `=>`, `is_null`, or `is_not_null`. Any other
> operator, such as `in`, `!=`, or `(.)`, returns a `400`. You cannot sort on
> either field.
>
> Education conditions in one `and` group match one school. So `=> 2023` and
> `=< 2025` on `end_year` find a person with one school that ended in that
> range. Add `education.schools.degree` to the same group to require that
> degree at that school. To let each condition match a different school, use
> an `all_of` group. See
> [Nested-array matching](#nested-array-matching-all_of-and-has_all).
>
> A value that is not a whole-number year returns a `400` with
> `'education.schools.end_year' filter value must be a single year (integer)`.
> A list is not a single year, so `in` gets this message too. Any other
> unsupported operator returns a `400` with
> `Operator '!=' is not supported for 'education.schools.end_year'. Use =, <, <=, >, >= or is_null.`
> The message names `<=` and `>=`, but the API rejects both. Send `=<` and
> `=>`.

### Certifications & honors

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `certifications.name` | string | Yes | No | Certification name |
| `certifications.issuing_organization` | string | Yes | No | Certification issuer |
| `certifications.issue_date` | date | Yes | No | Certification issue date |
| `certifications.expiration_date` | date | Yes | No | Certification expiration date |
| `certifications.credential_id` | string | Yes | No | Certification credential ID |
| `certifications.credential_url` | string | Yes | No | Certification credential URL |
| `honors.title` | string | Yes | No | Honor or award title |

### Social handles

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `social_handles.twitter_handle` | string | Yes | No | Twitter/X handle |

### Contact

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `contact.has_business_email` | boolean | Yes | No | A business email is on file |

### GitHub dev platform (filter-only)

These fields filter and sort on the GitHub account that best matches the
person. The field paths follow the `dev_platform_profiles` shape that
[Dev Platform Enrich](https://docs.crustdata.com/person-docs/dev_platform/introduction.md) returns. You can
use them only to search. The search response does not include any of these
fields. Filter here, then get the values with Dev Platform Enrich.

Account-level fields describe the whole account. The API calculates the rollup
values (`all_languages`, `all_topics`, `total_*`, `max_stars`, and
`median_stars`) across all of the person's owned repositories.

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `dev_platform_profiles.name` | string | Yes | No | Name on the GitHub profile |
| `dev_platform_profiles.bio` | string | Yes | No | Profile bio |
| `dev_platform_profiles.location` | string | Yes | No | Self-reported location |
| `dev_platform_profiles.website_url` | string | Yes | No | Blog / website URL |
| `dev_platform_profiles.company_text` | string | Yes | No | Company text on the profile |
| `dev_platform_profiles.is_hireable` | boolean | Yes | No | GitHub "available for hire" flag |
| `dev_platform_profiles.followers` | number | Yes | Yes | Follower count |
| `dev_platform_profiles.following` | number | Yes | Yes | Following count |
| `dev_platform_profiles.public_repo_count` | number | Yes | Yes | Public repositories owned |
| `dev_platform_profiles.metadata.created_at` | date | Yes | Yes | Account creation date |
| `dev_platform_profiles.total_repos` | number | Yes | Yes | Owned repositories tracked |
| `dev_platform_profiles.total_stars` | number | Yes | Yes | Stars across all owned repositories |
| `dev_platform_profiles.max_stars` | number | Yes | Yes | Stars on the most-starred repository |
| `dev_platform_profiles.median_stars` | number | Yes | Yes | Median stars across owned repositories |
| `dev_platform_profiles.all_languages` | array | Yes | No | Primary languages across all owned repositories |
| `dev_platform_profiles.all_topics` | array | Yes | No | Topic tags across all owned repositories |

Repository-level fields match the 25 owned repositories that the person pushed
to most recently:

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `dev_platform_profiles.repos.full_name` | string | Yes | No | `owner/repo` slug |
| `dev_platform_profiles.repos.owner` | string | Yes | No | Owning account login |
| `dev_platform_profiles.repos.description` | string | Yes | No | Repository description |
| `dev_platform_profiles.repos.primary_language` | string | Yes | No | Primary language of one repository. Two values under `and` can match two different repositories |
| `dev_platform_profiles.repos.topics` | array | Yes | No | Topic tags |
| `dev_platform_profiles.repos.license_key` | string | Yes | No | License key (for example `mit`) |
| `dev_platform_profiles.repos.is_fork` | boolean | Yes | No | Whether the repository is a fork |
| `dev_platform_profiles.repos.archived` | boolean | Yes | No | Archived flag |
| `dev_platform_profiles.repos.disabled` | boolean | Yes | No | Disabled flag |
| `dev_platform_profiles.repos.is_template` | boolean | Yes | No | Template repository flag |
| `dev_platform_profiles.repos.has_issues` | boolean | Yes | No | Issues enabled |
| `dev_platform_profiles.repos.has_projects` | boolean | Yes | No | Projects enabled |
| `dev_platform_profiles.repos.has_wiki` | boolean | Yes | No | Wiki enabled |
| `dev_platform_profiles.repos.stars` | number | Yes | No | Star count |
| `dev_platform_profiles.repos.forks_count` | number | Yes | No | Fork count |
| `dev_platform_profiles.repos.open_issues_count` | number | Yes | No | Open issue count |
| `dev_platform_profiles.repos.size` | number | Yes | No | Repository size (KB) |
| `dev_platform_profiles.repos.github_created_at` | date | Yes | No | Repository creation date |
| `dev_platform_profiles.repos.github_updated_at` | date | Yes | No | Last metadata update |
| `dev_platform_profiles.repos.github_pushed_at` | date | Yes | No | Last code push |

> [accordion] Example: hireable Rust developers with real traction
>
> This request finds Rust developers with the GitHub "available for hire" flag
> set. Each one has a repository with 500 or more stars and a code push on or
> after 2026-07-01. The request sorts the results by the most-starred repository:
>
> ```json Request body theme={"theme":"vitesse-black"}
> {
>     "filters": {
>         "op": "and",
>         "conditions": [
>             {
>                 "field": "dev_platform_profiles.is_hireable",
>                 "type": "=",
>                 "value": true
>             },
>             {
>                 "field": "dev_platform_profiles.all_languages",
>                 "type": "=",
>                 "value": "Rust"
>             },
>             {
>                 "field": "dev_platform_profiles.max_stars",
>                 "type": "=>",
>                 "value": 500
>             },
>             {
>                 "field": "dev_platform_profiles.repos.github_pushed_at",
>                 "type": "=>",
>                 "value": "2026-07-01"
>             }
>         ]
>     },
>     "sorts": [{ "field": "dev_platform_profiles.max_stars", "order": "desc" }],
>     "limit": 10,
>     "fields": [
>         "crustdata_person_id",
>         "basic_profile.name",
>         "basic_profile.location",
>         "social_handles"
>     ]
> }
> ```
>
> The response has the profile fields in `fields`, not the GitHub data. To see
> the repositories and stats, call
> [Dev Platform Enrich](https://docs.crustdata.com/person-docs/dev_platform/introduction.md) on a match.

> [accordion] Example: SF software engineers with 5+ years and a starred Rust repo
>
> You can combine GitHub filters with the regular profile filters. This request
> finds software engineers who match all of these conditions:
>
> * They are within 50 km of San Francisco.
> * They have at least 5 years of experience.
> * They have at least one repository whose primary language is Rust.
> * They have more than 20 stars across all owned repositories.
>
> The `(!)` condition removes interns. Several internship roles can add up to
> enough years to pass the years-of-experience filter:
>
> ```json Request body theme={"theme":"vitesse-black"}
> {
>     "filters": {
>         "op": "and",
>         "conditions": [
>             {
>                 "field": "experience.employment_details.current.title",
>                 "type": "(.)",
>                 "value": "software engineer"
>             },
>             {
>                 "field": "professional_network.location.raw",
>                 "type": "geo_distance",
>                 "value": {
>                     "location": "San Francisco",
>                     "distance": 50,
>                     "unit": "km"
>                 }
>             },
>             {
>                 "field": "years_of_experience_raw",
>                 "type": "=>",
>                 "value": 5
>             },
>             {
>                 "field": "experience.employment_details.current.title",
>                 "type": "(!)",
>                 "value": "intern"
>             },
>             {
>                 "field": "dev_platform_profiles.repos.primary_language",
>                 "type": "=",
>                 "value": "Rust"
>             },
>             {
>                 "field": "dev_platform_profiles.total_stars",
>                 "type": ">",
>                 "value": 20
>             }
>         ]
>     },
>     "limit": 10,
>     "fields": [
>         "crustdata_person_id",
>         "basic_profile.name",
>         "basic_profile.current_title",
>         "basic_profile.location",
>         "social_handles"
>     ]
> }
> ```
>
> `repos.primary_language` matches only the 25 most recently pushed
> repositories. To match a language in any of the person's repositories, filter
> on `dev_platform_profiles.all_languages` instead.
>
> > [!NOTE]
> >
> > The API checks each repository-level condition on its own, against any of
> > the 25 repositories. Forked repositories count. So a person whose only Rust
> > repository is a fork still matches. If you combine `repos.primary_language`
> > with `repos.is_fork`, the two conditions can match different repositories.
> > This is also true inside `all_of`. The star rollups (`total_stars` and
> > `max_stars`) also include forks.

### Research profiles

These fields filter, sort, and return the person's matched academic
author profiles. The paths follow the `research_profiles` shape that
[Person Enrich](https://docs.crustdata.com/person-docs/enrichment/reference.md#research_profiles-fields)
returns. The group is enabled per account. Without the grant, a filter or a
`fields` entry on any `research_profiles.*` path returns `403` with
`Access denied to fields: research_profiles`. Contact Crustdata to turn it on.

[Autocomplete](https://docs.crustdata.com/person-docs/autocomplete/introduction.md) supports
`research_profiles.research_interests` and
`research_profiles.affiliated_organisation`. Get the stored spelling there,
then filter with `=` or `in`.

A person can hold more than one author profile, so `research_profiles` is an
array, best match first. A filter matches when any of the person's profiles
matches. Each metric object (`citations_count`, `h_index`, `i10_index`) has
`all`, `recent`, and `recent_since_year`. You can filter and sort on `all` and
`recent`. `recent_since_year` is returned but not filterable.

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `research_profiles.name` | string | Yes | No | Name displayed on the profile |
| `research_profiles.designation` | string | Yes | No | Free-text affiliation as displayed on the profile |
| `research_profiles.affiliated_organisation` | string | Yes | No | Organisation extracted from the affiliation |
| `research_profiles.verified_email_domain` | string | Yes | No | Institution domain verified for the profile |
| `research_profiles.website` | string | Yes | No | Homepage supplied on the profile |
| `research_profiles.research_interests` | array | Yes | No | Interest labels as listed on the profile |
| `research_profiles.article_count` | number | Yes | Yes | Number of publications on the profile |
| `research_profiles.co_author_count` | number | Yes | Yes | Number of linked co-authors |
| `research_profiles.citations_count.all` | number | Yes | Yes | Lifetime citations |
| `research_profiles.citations_count.recent` | number | Yes | Yes | Citations since `recent_since_year` |
| `research_profiles.h_index.all` | number | Yes | Yes | Lifetime h-index |
| `research_profiles.h_index.recent` | number | Yes | Yes | h-index since `recent_since_year` |
| `research_profiles.i10_index.all` | number | Yes | Yes | Lifetime i10-index |
| `research_profiles.i10_index.recent` | number | Yes | Yes | i10-index since `recent_since_year` |
| `research_profiles.metadata.last_scraped_source` | date | Yes | Yes | When the profile was last refreshed from the web |
| `research_profiles.articles.title` | string | Yes | No | Publication title |
| `research_profiles.articles.url` | string | Yes | No | Citation page of the publication |
| `research_profiles.articles.publication_year` | string | Yes | No | Year of publication, as a string. Two years under `and` can match two different articles |
| `research_profiles.co_authors.id` | string | Yes | No | Profile identifier of a linked co-author |
| `research_profiles.co_authors.name` | string | Yes | No | Name of a linked co-author |

`research_profiles.id`, `research_profiles.profile_url`,
`research_profiles.thumbnail`, and the `recent_since_year` keys are returned
but not filterable. A filter on one of them returns `400` with
`Unsupported filter field`. The search copy of each profile is smaller than the
enrich copy: `articles[]` carries only `title`, `url`, and `publication_year`,
`co_authors[]` carries only `id` and `name`, and there is no
`citations_timeseries`. Get the full lists with
[Person Enrich](https://docs.crustdata.com/person-docs/enrichment/reference.md#research_profiles-fields).

### Profile assessment

These fields hold the Crustdata assessment of how well a profile passes
verification. Filter on them to remove low-quality profiles before you spend an
enrich credit. [Person Enrich](https://docs.crustdata.com/person-docs/enrichment/reference.md#assessment-fields)
returns the values. Search does not.

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `assessment.authenticity.tier` | integer | Yes | Yes | 0 (most trusted) to 9 (least trusted). Sort ascending for most trusted first. |
| `assessment.authenticity.verdict` | string | Yes | No | `clearly_genuine`, `probably_genuine`, `cannot_verify`, `probably_fabricated`, `clearly_fabricated`. |

You can sort on `tier` only. A sort on `verdict` returns
`Unsupported sort field(s)`.

> [!NOTE]
>
> Use `tier` to remove low-quality profiles. Few untrusted profiles have a
> `verdict`. Of the 25,434 profiles at tier 9, only 11 have a verdict. So a
> `verdict` filter misses almost all of them. A null `verdict` means "not
> labeled", not "genuine". To select on it, use `is_null` or `is_not_null`.

### Other

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `recently_changed_jobs` | boolean | Yes | Yes | True when a past role ended within 90 days of the last index rebuild. It marks a role that ended, not a new role that started. To find people who recently started a role, filter on `current.start_date` |
| `years_of_experience_raw` | number | Yes | Yes | Total years of experience, for example `12` |
| `years_of_experience` | string | Yes | No | Total experience as a band, for example `More than 10 years` |

### Open-to signal values

`professional_network.open_to_cards` holds codes from a fixed list of three. Filter with the `in` operator and one or more of these codes:

| Code | Meaning |
| - | - |
| `CAREER_INTEREST` | Profile is open to new career opportunities |
| `HIRING_MANAGER` | Profile is actively hiring |
| `VOLUNTEERING` | Profile is open to volunteer work |

> [!WARNING]
>
> The index holds only the three codes above. A human-readable string, such
> as `"open_to_work"` or `"Open to Work"`, returns `400` with the list of the
> three codes. The match ignores case, so `"career_interest"` also works.

```json Filter example theme={"theme":"vitesse-black"}
{
    "filters": {
        "op": "and",
        "conditions": [
            {
                "field": "professional_network.open_to_cards",
                "type": "in",
                "value": ["CAREER_INTEREST"]
            }
        ]
    },
    "limit": 5
}
```

## Response fields

Each profile in the response has `crustdata_person_id`, even when you do not request it. It can also include these sections, depending on `fields`. A field you request that has no data for the profile is `null`. This table shows only the returned sections. It is not a complete filter reference.

| Section | Key fields | Description |
| - | - | - |
| `basic_profile` | `name`, `headline`, `current_title`, `normalized_title`, `professional_network_name`, `location` | Identity and location |
| `experience` | `employment_details.current`, `employment_details.past` (each role includes `company_status` and `company_profile_picture_permalink`), `recently_changed_jobs` | Full work history. `recently_changed_jobs` is enabled per account. See the note below |
| `education` | `schools` (each includes `school`, `degree`, `location`, `description`, `institute_logo_permalink`) | Education background |
| `contact` | `has_business_email` | Contact availability flag |
| `social_handles` | `professional_network_identifier.profile_url`, `dev_platform_identifier.profile_url`, `twitter_identifier.slug` | Available profile handles |
| `skills` | `professional_network_skills` | Listed skills. Enabled per account. See the note below |
| `certifications` | `name`, `issuing_organization`, `issue_date`, `expiration_date`, `credential_id`, `credential_url` | Certifications on the profile. Enabled per account. See the note below |
| `honors` | `title`, `issuer`, `issued_date`, `description`, `associated_organization` | Honors and awards on the profile. Enabled per account. See the note below |
| Top-level fields | `years_of_experience`, `years_of_experience_raw` | Total experience as a band, for example `More than 10 years`, and as a number of years, for example `20`. Enabled per account. See the note below |
| `research_profiles` | `id`, `profile_url`, `name`, `designation`, `affiliated_organisation`, `verified_email_domain`, `website`, `research_interests`, `thumbnail`, `article_count`, `co_author_count`, `citations_count`, `h_index`, `i10_index`, `articles` (`title`, `url`, `publication_year`), `co_authors` (`id`, `name`), `metadata.last_scraped_source` | Matched academic author profiles, best match first. Enabled per account and never returned by default. See [Research profiles](#research-profiles) |

> [!NOTE]
>
> Search returns `skills` only when your account has access to the field.
> Without access, the default response leaves `skills` out. A `fields` entry
> for `skills` returns `403` with `Access denied to fields: skills`, and the
> message continues with a link to request access. A `fields` entry for
> `skills.professional_network_skills` returns the same error with that
> path. You can filter on `skills.professional_network_skills` without
> access.
>
> These fields work the same way: `certifications`, `honors`,
> `years_of_experience`, `years_of_experience_raw`, and
> `experience.recently_changed_jobs`. Search returns them only when your
> account has access. Without access, the default response leaves them out,
> and a `fields` entry for one of them returns `403`. The message lists each
> denied path that you sent, for example
> `Access denied to fields: certifications.name`, and continues with a link
> to request access. You can filter on all of these fields without access.
>
> Search never returns `dev_platform_profiles`, for any account. A `fields`
> entry for it returns `400` with `Invalid fields: dev_platform_profiles`.
> Get GitHub data with
> [Dev Platform Enrich](https://docs.crustdata.com/person-docs/dev_platform/introduction.md). You can
> still filter on the `dev_platform_profiles.*` GitHub fields. See
> [Filterable but not returned](#filterable-but-not-returned).

### Remarks

Every search response has a `remarks` array. It is `[]` when the API has no remark. A remark is a machine-readable note about the request that you sent.

| Field | Stable | Description |
| - | - | - |
| `code` | Yes | What the remark says. Codes today: `condition_eliminates_all`, `no_single_culprit`. Later features add their own. |
| `path` | Yes | Where it applies: `filters` when the whole filter is one condition, `filters.conditions[i]` for the i-th condition of your top-level `and`. Absent on `no_single_culprit`. |
| `matches_without` | Yes | On `condition_eliminates_all`: how many profiles the search returns with that condition removed. |
| `message` | No | A plain-English explanation. It can change without notice. |
| `hint` | No | A next step, when the API knows one. It can change without notice. |
| `resolution` | Partly | On `condition_eliminates_all` for a company name or website domain condition: the `company_id` filter that recovers profiles. `field`, `value` and `matches_with` are stable; `companies[].name` may change. |

In your code, branch on `code` and `path`. Do not parse `message` or `hint`.

To explain an empty result, send `"explain": true` with a filters-only request.
When the search returns `total_count` 0, the API removes one top-level condition
at a time and counts again. It names each condition whose removal gets profiles
back. The request below returns nobody, and the API names two conditions:

* The nine exact titles. 22 people match without them.
* The company page URL. 422,469 people match without it.

Each condition removes everyone that the other conditions find. So each one is a
culprit on its own: a condition that empties the result by itself.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/person/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "op": "and",
      "conditions": [
        {
          "field": "experience.employment_details.current.company_professional_network_profile_url",
          "type": "in",
          "value": ["https://www.linkedin.com/company/dr-juchheim-cosmetics"]
        },
        {
          "field": "basic_profile.location.country",
          "type": "in",
          "value": ["Germany", "Austria", "Switzerland"]
        },
        {
          "field": "experience.employment_details.current.title",
          "type": "in",
          "value": ["Geschäftsführer", "Vertriebsleiter", "Vertriebsdirektor", "VP Sales", "Sales Director", "CEO", "Founder", "Inhaber", "Managing Director"]
        }
      ]
    },
    "limit": 4,
    "explain": true
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "profiles": [],
    "next_cursor": null,
    "total_count": 0,
    "total_count_relation": null,
    "remarks": [
        {
            "code": "condition_eliminates_all",
            "path": "filters.conditions[2]",
            "message": "experience.employment_details.current.title in [9 values] removes every result (22 match without it).",
            "matches_without": 22,
            "hint": "'in' on title matches the whole stored string, not words inside it. Replace it with an or group of [.] leaves, one value each, for a phrase match; or remove it (and the group holding it, if it holds nothing else) and rank the remaining scope by meaning: add \"search\": {\"query\": \"Geschäftsführer\"} and top-level \"mode\": \"exact\" (drop \"sorts\")."
        },
        {
            "code": "condition_eliminates_all",
            "path": "filters.conditions[0]",
            "message": "experience.employment_details.current.company_professional_network_profile_url in ['https://www.linkedin.com/company/dr-juchheim-cosmetics'] removes every result (422,469 match without it).",
            "matches_without": 422469
        }
    ]
}
```

How the explain step works:

* The API tests only the conditions of your top-level `and`, one at a time, and at most six of them. A nested `or` group counts as one condition. The API never opens it. The API tests exact-match conditions (`=`, `in`) on titles, company names, and website domains first.
* The API can name several conditions. If no single condition explains the empty result, you get one `no_single_culprit` remark. Its message says how many conditions the API tested.
* The tests cost nothing. An empty result uses no credits, with or without `explain`.
* These requests return `remarks: []`: a request with a `search` block, a request with results, and a cursor page. Error responses never include `remarks`.

When the named condition is a title: a title is free text. So a title condition that empties the result usually means that the people in scope (the people that your other filters select) have the role under other words. It does not mean that nobody there does the job. Do these steps:

1. Remove the title condition, and keep the rest of your filters.
2. Put the title in `search.query`, with the top-level `"mode": "exact"`.

The search then ranks the people in scope by meaning, not by string match. If you remove the last condition of a group, remove the group too, because the API rejects an empty `conditions` list.

The title operators also differ more than they look. `=` and `in` match the whole stored string and ignore case, so `["head of procurement"]` and `["Head of Procurement"]` return the same profiles. `[.]` matches a phrase anywhere in the value and takes one string, not a list.

When the named condition is a company name or website domain under `=` or `in`, the explain step also looks for company records that are the same company:

* A domain counts when it is the registered domain with no subdomain, and a record has exactly that domain.
* A name counts when it equals a stored name after the API ignores case, punctuation, and legal suffixes (`Inc`, `Ltd`, `GmbH`). So `Qorvo` reaches `Qorvo, Inc.` but not `Qorvo China`.

The API then counts again with `company_id in <those ids>` added to the condition with OR. If that gets profiles back, the remark has a `resolution`. Your result does not change. To get those profiles, send the request again with the filter in `resolution.field` and `resolution.value`. For example, a search for `rubrik.com` returns nobody, because the stored domain is a different host. The remark names the company ID that has the profiles:

```json Remark theme={"theme":"vitesse-black"}
{
    "code": "condition_eliminates_all",
    "path": "filters",
    "message": "experience.employment_details.current.company_website_domain = 'rubrik.com' removes every result.",
    "resolution": {
        "field": "experience.employment_details.current.company_id",
        "value": [631360],
        "companies": [{"company_id": 631360, "name": "Rubrik"}],
        "matches_with": 4804
    },
    "hint": "Filter by experience.employment_details.current.company_id in [631360] to match 4,804 people."
}
```

If a remark has no `resolution`, no record passed the rule, or no record got profiles back. The `hint` then gives the reason:

* The name or domain has no company record.
* The domain is a subdomain. The index does not hold subdomains.
* The stored form is different from yours.

A remark on a request with one condition has no `matches_without`, because a search without its only condition would count everyone.

### Filter paths and their returned twins

Eight filter paths return their data under a different path in the response.
Six of them are employer paths. Filter on the path in the left column. Read the
value from the path in the right column:

| Filter path | Returned under |
| - | - |
| `experience.employment_details.current.company_name` | `experience.employment_details.current.name` |
| `experience.employment_details.current.company_id` | `experience.employment_details.current.crustdata_company_id` |
| `experience.employment_details.current.company_website_domain` | `experience.employment_details.current.company_website` |
| `experience.employment_details.past.company_name` | `experience.employment_details.past.name` |
| `experience.employment_details.past.company_id` | `experience.employment_details.past.crustdata_company_id` |
| `experience.employment_details.past.company_website_domain` | `experience.employment_details.past.company_website` |
| `basic_profile.summary` | `professional_network.summary` |
| `recently_changed_jobs` | `experience.recently_changed_jobs` |

`professional_network.summary` and `experience.recently_changed_jobs` are
enabled per account. Without access, a `fields` entry for either one returns
`403`.

If you put a filter path in `fields`, the API returns `400`. The message gives
you the twin path to use instead:

```json theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Invalid fields: experience.employment_details.current.company_name. 'experience.employment_details.current.company_name' is a filter path. In fields, use 'experience.employment_details.current.name'."
    }
}
```

Three all-employers paths filter across every job, but the API never returns
them:
`experience.employment_details.company_name`,
`experience.employment_details.company_id`, and
`experience.employment_details.company_website_domain`. If you put one of them
in `fields`, the API returns `400` with this error:

```json theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Invalid fields: experience.employment_details.company_name. 'experience.employment_details.company_name' can be filtered on but is not returned by search."
    }
}
```

Filter on these three paths when you do not care which job matched. Then read
the value from the `current.` or `past.` twin above.

### Filterable but not returned

You can use some fields in `filters`, but the search response does not include
them. Search is for discovery, not for full enrichment. Filter on these fields,
then get their values with [Person Enrich](https://docs.crustdata.com/person-docs/enrichment/introduction.md).
For example, you can filter on `assessment.authenticity.*` here, but only
Enrich returns it. If you put it in `fields` here, the API returns `400` with
`Invalid fields: assessment.authenticity.tier`.

| Field | Filterable | Returned |
| - | - | - |
| `dev_platform_profiles.*` (GitHub account, rollups, repos) | Yes | No |
| `assessment.authenticity.*` (tier, verdict) | Yes | No |

Search returns `certifications`, `honors`, and the years-of-experience fields
when your account has access to them. See [Response fields](#response-fields).

> [!NOTE]
>
> The reverse is true for a few fields. Search returns the person's profile
> URL (`social_handles.professional_network_identifier.profile_url`), but you
> cannot filter on it. To find people at a company, filter on the company URL
> of the employer
> (`experience.employment_details.current.company_professional_network_profile_url`)
> instead.

***

## Request parameter reference

| Parameter | Type | Required | Default | Description |
| - | - | - | - | - |
| `filters` | object | Yes | n/a | Filter condition or condition group. See [operators](#filter-operator-reference) above. |
| `fields` | string\[] | No | Default set | The dot-path fields or sections to return, for example `["basic_profile.name", "experience.employment_details.current.title"]`. If you omit it, the API returns the default profile sections. `crustdata_person_id` is always included. Search returns `skills`, `certifications`, `honors`, `years_of_experience`, `years_of_experience_raw`, and `experience.recently_changed_jobs` only when your account has access to them. Without access, naming one of them returns `403`. Search never returns `dev_platform_profiles`. `research_profiles` is enabled per account and returns `403` without the grant. |
| `sorts` | array | No | `[]` | Sort specifications as an array of `{ field, order }` objects. Use `asc` or `desc` for `order`. You need it for stable pagination. |
| `limit` | integer | No | 20 | The maximum number of profiles per page, from 1 to 1000. |
| `count` | integer | No | n/a | Alias for `limit`. |
| `cursor` | string | No | `null` | The pagination cursor from `next_cursor` in the previous response. |
| `post_processing` | object | No | n/a | `exclude_profiles` (URL array) and `exclude_names` (name array). |
| `preview` | boolean | No | `false` | Premium feature. See [Preview mode](#preview-mode). |
| `return_query` | boolean | No | `false` | Debug flag accepted by the API. The response does not include a top-level `query` field. |
| `explain` | boolean | No | `false` | Explains an empty result. If it is `true` and a filters-only request returns `total_count` 0, `remarks` names the condition whose removal gets profiles back. See [Remarks](#remarks). This is not the `search.explain` flag on semantic search, which returns the score for each result. |

## Preview mode

> [card] [Preview mode](https://crustdata.com/demo)
>
> Preview search is a premium feature. To turn it on for your account, book a
> demo.

If your account has preview, send `preview: true` to get smaller results before you run a full search. A preview response has the same top-level shape, but it can have fewer profile fields.

If your account does not have preview, the API returns `403` with this error:

```json theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "permission_error",
        "message": "Preview mode is not enabled for your account. To enable it, please book a call with us at https://meetings-na2.hubspot.com/chris-pisarski/product-call-request?call_reason=I+need+preview+mode+enabled+on+my+account",
        "metadata": []
    }
}
```

```bash Preview search theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/person/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "field": "experience.employment_details.title",
      "type": "(.)",
      "value": "Founder"
    },
    "preview": true,
    "limit": 1
  }'
```

***

## Errors

| Status | Meaning |
| - | - |
| `400` | Invalid request: unsupported field, wrong operator, malformed filters, or an invalid or mismatched `cursor`. |
| `401` | Invalid or missing API key. |
| `403` | Permission denied, preview mode not enabled for your account, or insufficient credits. |
| `500` | Internal server error. Retry with exponential backoff. |

### No results

When no people match the filters, the API returns `200` with an empty `profiles` array:

```json theme={"theme":"vitesse-black"}
{
    "profiles": [],
    "next_cursor": null,
    "total_count": 0,
    "total_count_relation": null,
    "remarks": []
}
```

To fix an empty result, do one of these:

* Send the request again with `"explain": true` to learn which condition removed every result. See [Remarks](#remarks).
* Use wider filters.
* Check the field values with [Autocomplete](https://docs.crustdata.com/person-docs/autocomplete/introduction.md).

> [!NOTE]
>
> To match many values of a field, put all of them in one `in` condition, not
> in many separate conditions. The API runs one `in` condition as one
> efficient query. An `in` list of up to about 5,000 to 10,000 values returns
> in a few seconds. Larger lists get slower, and the API rejects very large
> lists of about 50,000 values or more. For a larger set, split the values
> into chunks of about 5,000 to 10,000. Send one request for each chunk, and
> merge the results. The request body has a hard limit of 10 MB. A larger
> body returns `413 request_too_large`. With typical payloads, you reach the
> query-size limit first.

***

## API reference summary

| Detail | Value |
| - | - |
| Endpoint | `POST /person/search` |
| Auth | Bearer token + `x-api-version: 2025-11-01` |
| Response | `{ "profiles": [...], "next_cursor": "...", "total_count": N }` |
| Pagination | It uses a cursor. Send `next_cursor` as `cursor`. Stop when `next_cursor` is `null`. |
| Errors | `400`, `401`, `403`, `500` |

## Paginate through results

When your search matches more profiles than your `limit`, use the cursor to get every page.

For the first page, send your normal search request.

```bash First page theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/person/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "field": "experience.employment_details.company_name",
      "type": "in",
      "value": ["Retool"]
    },
    "limit": 100
  }'
```

For the next page, take the `next_cursor` value from the response and send it as `cursor` in your next request. Keep `filters`, `sorts`, `search`, and `mode` the same.

```bash Next page theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/person/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "field": "experience.employment_details.company_name",
      "type": "in",
      "value": ["Retool"]
    },
    "limit": 100,
    "cursor": "PASTE_NEXT_CURSOR_VALUE_HERE"
  }'
```

Continue until `next_cursor` is `null`. A `null` value means that you have the last page.

> [!WARNING]
>
> When you paginate, always send `sorts` so that the order stays the same
> across pages.

> [!NOTE]
>
> The cursor has these rules:
>
> * The cursor is tied to the query that made it. Keep `filters`, `sorts`,
>   `search`, and `mode` the same on every page. You can change `limit`,
>   `fields`, and `search.explain` on any page. The API does not reject every
>   change. A filter-only search ties the cursor to `filters` and `sorts`. A
>   search ranked on query text ties it to `filters`, `search`, and `mode`,
>   and does not accept `sorts`. You cannot tell which of the two ran your
>   request, because the parser can move a whole `search` block into filters
>   and leave no text to rank. So keep all four the same, and do not wait for
>   an error. `search.query_syntax` is tied only when you set it to
>   `boolean`.
> * A cursor has no expiry time. It does not fail because it is old. But for a
>   query that has `search`, the API keeps the result order for 20 minutes.
>   After that, the API calculates the order again, and rows can move between
>   pages. Get all the pages in one session.
> * Send the cursor back exactly as you received it. Treat it as an opaque
>   string. A re-encoded cursor, a removed `=` padding character, or a changed
>   character fails with `Invalid cursor`. There is one exception: a change to
>   the last character can decode to the same value. So the absence of an
>   error does not prove that your copy is correct.

***

## Sort results

Use the `sorts` parameter to sort the results by a field. You need a sort for stable pagination.

```bash Sort by connections (descending) theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/person/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "field": "experience.employment_details.current.title",
      "type": "=",
      "value": "CEO"
    },
    "sorts": [{"field": "professional_network.connections", "order": "desc"}],
    "limit": 5,
    "fields": ["crustdata_person_id", "basic_profile.name"]
  }'
```

You can sort on these fields: `crustdata_person_id`, `metadata.updated_at`, `basic_profile.name`, `basic_profile.location`, `basic_profile.location.city`, `basic_profile.location.state`, `basic_profile.location.country`, `basic_profile.location.full_location`, `professional_network.connections`, `professional_network.followers`, `experience.employment_details.start_date`, `experience.employment_details.company_id`, `experience.employment_details.company_headcount_latest`, `experience.employment_details.years_at_company_raw`, `recently_changed_jobs`, `years_of_experience_raw`, `assessment.authenticity.tier`, `dev_platform_profiles.followers`, `dev_platform_profiles.following`, `dev_platform_profiles.metadata.created_at`, `dev_platform_profiles.public_repo_count`, `dev_platform_profiles.total_repos`, `dev_platform_profiles.total_stars`, `dev_platform_profiles.max_stars`, `dev_platform_profiles.median_stars`, `research_profiles.article_count`, `research_profiles.co_author_count`, `research_profiles.citations_count.all`, `research_profiles.citations_count.recent`, `research_profiles.h_index.all`, `research_profiles.h_index.recent`, `research_profiles.i10_index.all`, `research_profiles.i10_index.recent`, and `research_profiles.metadata.last_scraped_source`. A sort on a field that the API does not support returns `400` with `Unsupported sort field(s)`. The `research_profiles.*` sort fields are enabled per account, see [Research profiles](#research-profiles).

On the `dev_platform_profiles.*` sort fields, profiles without a linked GitHub account come last, for both `asc` and `desc`.

The Sortable column in [Searchable fields](#searchable-fields) shows which
fields you can sort on. The Filterable column shows which fields you can filter
on.

For the complete OpenAPI schema, see the [full API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md).


## Related topics

- [Semantic People Search API](https://docs.crustdata.com/guides/person-semantic-search.md)
- [Person Discovery Watcher](https://docs.crustdata.com/watcher-docs/person/discovery.md)
- [Job Title Normalization](https://docs.crustdata.com/guides/job-title-normalization.md)
- [Data Export](https://docs.crustdata.com/export-docs/data-export.md)
- [Batch Search Person](https://docs.crustdata.com/api-reference/batch-apis/submit-a-batch-person-database-search-job.md)
