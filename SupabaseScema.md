# Supabase Schema

## `audit_logs`

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| user_id | uuid | YES | `null` |
| action | text | NO | `null` |
| entity_type | text | NO | `null` |
| entity_id | text | YES | `null` |
| metadata | jsonb | YES | `null` |
| ip_address | text | YES | `null` |
| created_at | timestamp with time zone | NO | `now()` |

## `cached_quries`

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| query | text | NO | `null` |
| answer | text | YES | `null` |
| metadata | jsonb | NO | `'{}'::jsonb` |
| created_by | uuid | YES | `null` |
| created_at | timestamp with time zone | NO | `now()` |
| updated_at | timestamp with time zone | NO | `now()` |
| normalized_query | text | YES | `null` |
| is_vectorized | boolean | NO | `false` |
| vectorized_at | timestamp with time zone | YES | `null` |
| hit_count | bigint | NO | `0` |
| session_id | text | YES | `null` |
| model_name | text | YES | `null` |
| source_type | text | YES | `null` |

## `conversations`

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| user_id | uuid | NO | `null` |
| title | text | NO | `'New Conversation'::text` |
| is_active | boolean | NO | `true` |
| created_at | timestamp with time zone | NO | `now()` |
| updated_at | timestamp with time zone | NO | `now()` |
| ret_session_id | text | YES | `null` |

## `courses`

| Column | Type | Nullable | Default |
|---|---|---|---|
| code | text | NO | `null` |
| name | text | NO | `null` |
| school_code | text | YES | `null` |
| academic_level | text | YES | `null` |
| max_semesters | integer | YES | `null` |
| created_at | timestamp with time zone | NO | `timezone('utc'::text, now())` |
| updated_at | timestamp with time zone | NO | `timezone('utc'::text, now())` |

## `document_types`

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| code | text | NO | `null` |
| name | text | NO | `null` |
| created_at | timestamp with time zone | NO | `now()` |
| updated_at | timestamp with time zone | NO | `now()` |

## `documents`

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| title | text | NO | `null` |
| file_name | text | NO | `null` |
| file_url | text | NO | `null` |
| storage_path | text | NO | `null` |
| file_size | integer | NO | `0` |
| issuing_authority | text | NO | `null` |
| effective_from | date | YES | `null` |
| effective_till | date | YES | `null` |
| semester | text | YES | `null` |
| keywords | ARRAY | YES | `null` |
| uploaded_by | uuid | YES | `null` |
| created_at | timestamp with time zone | NO | `now()` |
| updated_at | timestamp with time zone | NO | `now()` |
| type_id | uuid | YES | `null` |
| school_code | text | YES | `null` |
| course_code | text | YES | `null` |

## `file_job`

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `null` |
| status | text | NO | `'pending'::text` |
| retries | integer | NO | `0` |

## `messages`

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| conversation_id | uuid | NO | `null` |
| role | text | NO | `null` |
| content | text | NO | `null` |
| sources | jsonb | YES | `null` |
| confidence | numeric | YES | `null` |
| created_at | timestamp with time zone | NO | `now()` |

## `resolved_knowledge`

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| question | text | NO | `null` |
| answer | text | NO | `null` |
| ticket_id | uuid | NO | `null` |
| created_at | timestamp with time zone | NO | `now()` |

## `schools`

| Column | Type | Nullable | Default |
|---|---|---|---|
| code | text | NO | `null` |
| name | text | NO | `null` |
| created_at | timestamp with time zone | NO | `timezone('utc'::text, now())` |
| updated_at | timestamp with time zone | NO | `timezone('utc'::text, now())` |

## `ticket_events`

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| ticket_id | uuid | NO | `null` |
| event_type | text | NO | `null` |
| actor_id | uuid | YES | `null` |
| metadata | jsonb | NO | `'{}'::jsonb` |
| created_at | timestamp with time zone | NO | `now()` |

## `ticket_messages`

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| ticket_id | uuid | NO | `null` |
| sender_id | uuid | YES | `null` |
| sender_type | USER-DEFINED | NO | `null` |
| message | text | NO | `null` |
| created_at | timestamp with time zone | NO | `now()` |

## `tickets`

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| conversation_id | uuid | YES | `null` |
| user_id | uuid | NO | `null` |
| query | text | NO | `null` |
| status | USER-DEFINED | NO | `'open'::ticket_status` |
| priority | USER-DEFINED | NO | `'medium'::ticket_priority` |
| category | text | YES | `null` |
| confidence_score | double precision | YES | `null` |
| assigned_to | uuid | YES | `null` |
| created_at | timestamp with time zone | NO | `now()` |
| updated_at | timestamp with time zone | NO | `now()` |
| resolved_at | timestamp with time zone | YES | `null` |

## `users`

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| auth_id | text | NO | `null` |
| email | text | NO | `null` |
| name | text | NO | `null` |
| role | text | NO | `'student'::text` |
| roll_number | text | YES | `null` |
| image_url | text | YES | `null` |
| created_at | timestamp with time zone | NO | `now()` |
| updated_at | timestamp with time zone | NO | `now()` |
| is_allowed | boolean | NO | `true` |
| school_code | text | YES | `null` |
| course_code | text | YES | `null` |

