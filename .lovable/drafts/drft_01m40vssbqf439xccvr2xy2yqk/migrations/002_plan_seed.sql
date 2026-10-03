-- BlackRock 2027 Spring Insight Event – EMEA, from the official page (checked 2026-10-03).
-- Replace 'blackrock-spring-insight-emea-2027' with the real id in your opportunities table.
-- The official page does not list a CV or cover letter; students add those if the application form asks for them.

insert into public.plan_opportunity_dates (opportunity_id, application_deadline, start_date)
values ('blackrock-spring-insight-emea-2027', '2026-12-04', '2027-04-01')
on conflict (opportunity_id) do update
  set application_deadline = excluded.application_deadline, start_date = excluded.start_date;

insert into public.plan_requirements
  (id, opportunity_id, kind, label, stage, required, due_date, due_after, due_after_days, evidence_quote, source_url, source, status, note)
values
('br-online-application', 'blackrock-spring-insight-emea-2027', 'online_application',
 'Submit the online application (one programme, up to two functions)', 'application', true, null, null, null,
 'Candidates can apply for only one programme',
 'https://careers.blackrock.com/job/london/2027-spring-insight-event-emea/45831/97150826752', 'official_page', 'published',
 'Applications may close before the deadline, so apply early.'),
('br-pre-interview-assessment', 'blackrock-spring-insight-emea-2027', 'online_test',
 'Complete the pre-interview assessment', 'assessment', true, null, 'submitted', 5,
 'You have up to five days to submit your pre-interview assessment',
 'https://careers.blackrock.com/job/london/2027-spring-insight-event-emea/45831/97150826752', 'official_page', 'published',
 'The invitation arrives by email after you submit.')
on conflict (id) do update
  set label = excluded.label, evidence_quote = excluded.evidence_quote, note = excluded.note;

insert into public.plan_notices (id, opportunity_id, text, evidence_quote, source_url) values
('br-notice-withdraw', 'blackrock-spring-insight-emea-2027',
 'If you withdraw, you cannot apply to this programme again this year.',
 'If you withdraw your application, you cannot submit another application for this programme this year.',
 'https://careers.blackrock.com/job/london/2027-spring-insight-event-emea/45831/97150826752'),
('br-notice-assessment', 'blackrock-spring-insight-emea-2027',
 'Missing the 5-day assessment window withdraws your application automatically.',
 'if you fail to do so, your application will be automatically withdrawn',
 'https://careers.blackrock.com/job/london/2027-spring-insight-event-emea/45831/97150826752'),
('br-notice-same-application', 'blackrock-spring-insight-emea-2027',
 'Apply for both functions in the same application.',
 'You must apply for both opportunities using the same programme application.',
 'https://careers.blackrock.com/job/london/2027-spring-insight-event-emea/45831/97150826752')
on conflict (id) do update set text = excluded.text, evidence_quote = excluded.evidence_quote;
