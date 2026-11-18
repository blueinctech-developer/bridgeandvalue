-- Removes the Gerow theme's demo content that was live on the WordPress site and copied
-- into the rebuild: demo homepages, Typography, Team Details, Our Projects and its 13 demo
-- projects and 13 project categories (33 pages). They are unpublished (kept in the
-- database, so any can be republished in the admin) and their old addresses, which search
-- engines may have indexed, get permanent redirects to the nearest real page.
-- The WordPress import never changes a page's status, so re-running it keeps them hidden.

UPDATE pages SET status = 'draft', in_sitemap = false, updated_at = now()
WHERE path IN (
  '/home/',
  '/home-two/',
  '/home-four/',
  '/home-five/',
  '/typography/',
  '/team-details/',
  '/our-projects/',
  '/project/finance-consultancy/',
  '/project/speed-optimized/',
  '/project/capital-faster/',
  '/project/illustration-design/',
  '/project/design-development/',
  '/project/marketing-consultancy/',
  '/project/digital-marketing/',
  '/project/strategic-planning/',
  '/project/based-on-your-correct-situation/',
  '/project/best-mortgage-rates-guaranteed/',
  '/project/investment-policy-for-new-project/',
  '/project/keep-your-business-safe-with-consultancy/',
  '/project/business-solution/',
  '/project-cat/achievment/',
  '/project-cat/advisory/',
  '/project-cat/business/',
  '/project-cat/business-strategy/',
  '/project-cat/capital/',
  '/project-cat/creative-work/',
  '/project-cat/development/',
  '/project-cat/investment/',
  '/project-cat/marketing/',
  '/project-cat/optimized/',
  '/project-cat/planing/',
  '/project-cat/skill-development/',
  '/project-cat/solution/'
);

INSERT INTO redirects (source, destination, status_code, note) VALUES
  ('/home/', '/', 301, 'Theme demo page removed'),
  ('/home-two/', '/', 301, 'Theme demo page removed'),
  ('/home-four/', '/', 301, 'Theme demo page removed'),
  ('/home-five/', '/', 301, 'Theme demo page removed'),
  ('/typography/', '/', 301, 'Theme demo page removed'),
  ('/team-details/', '/about-us/', 301, 'Theme demo page removed'),
  ('/our-projects/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project/finance-consultancy/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project/speed-optimized/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project/capital-faster/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project/illustration-design/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project/design-development/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project/marketing-consultancy/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project/digital-marketing/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project/strategic-planning/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project/based-on-your-correct-situation/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project/best-mortgage-rates-guaranteed/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project/investment-policy-for-new-project/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project/keep-your-business-safe-with-consultancy/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project/business-solution/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project-cat/achievment/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project-cat/advisory/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project-cat/business/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project-cat/business-strategy/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project-cat/capital/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project-cat/creative-work/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project-cat/development/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project-cat/investment/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project-cat/marketing/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project-cat/optimized/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project-cat/planing/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project-cat/skill-development/', '/our-services/', 301, 'Theme demo page removed'),
  ('/project-cat/solution/', '/our-services/', 301, 'Theme demo page removed')
ON CONFLICT (source) DO NOTHING;
