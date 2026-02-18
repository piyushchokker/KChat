import type { School, DocumentType } from "@/types";

export const APP_NAME = "KChat";
export const UNIVERSITY_NAME = "K.R. Mangalam University";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

// ---------- Schools & Courses ----------
export const SCHOOLS: School[] = [
  {
    id: "base",
    name: "KRMU (General University Documents)",
    courses: [
      { id: "general", name: "General University Circulars", level: "General" },
      { id: "admissions", name: "Admissions", level: "General" },
      { id: "examinations", name: "Examinations", level: "General" },
      { id: "scholarships", name: "Scholarships", level: "General" },
      { id: "hostel", name: "Hostel & Accommodation", level: "General" },
      { id: "library", name: "Library", level: "General" },
      { id: "sports", name: "Sports & Recreation", level: "General" },
      { id: "campus_facilities", name: "Campus Facilities", level: "General" },
      { id: "rules_regulations", name: "Rules & Regulations", level: "General" },
      { id: "other", name: "Other", level: "General" },
    ],
  },
  {
    id: "soet",
    name: "School of Engineering & Technology",
    courses: [
      { id: "btech_cse", name: "B.Tech. Computer Science and Engineering", level: "UG" },
      { id: "btech_cse_lateral", name: "B.Tech. Computer Science and Engineering (Lateral)", level: "UG" },
      { id: "btech_cse_aiml_ibm_ms", name: "B.Tech. Computer Science and Engineering (AI & ML) with academic support of IBM & powered by Microsoft Certifications", level: "UG" },
      { id: "btech_cse_aiml_ibm_samatrix_lateral", name: "B.Tech. Computer Science and Engineering (AI & ML) with academic support of Samatrix & IBM (Lateral)", level: "UG" },
      { id: "btech_cse_fsd_imaginxp", name: "B.Tech. Computer Science and Engineering (Full Stack Development) with academic support of ImaginXP", level: "UG" },
      { id: "btech_cse_fsd_xebia_lateral", name: "B.Tech. Computer Science and Engineering (Full Stack Development) with academic support of Xebia (Lateral)", level: "UG" },
      { id: "btech_cse_uxui_imaginxp", name: "B.Tech. Computer Science & Engineering (UX/UI) with academic support of ImaginXP", level: "UG" },
      { id: "btech_cse_uxui_imaginxp_lateral", name: "B.Tech. Computer Science and Engineering (UX/UI) with academic support of ImaginXP (Lateral)", level: "UG" },
      { id: "btech_cse_cybersec_ec_ibm", name: "B.Tech. Computer Science and Engineering (Cyber Security) with academic support of EC-Council and IBM", level: "UG" },
      { id: "btech_cse_cybersec_ec_ibm_lateral", name: "B.Tech. Computer Science and Engineering (Cyber Security) with academic support of EC-Council and IBM (Lateral)", level: "UG" },
      { id: "btech_cse_datascience_ibm", name: "B.Tech. Computer Science and Engineering (Data Science) with academic support of IBM", level: "UG" },
      { id: "btech_cse_datascience_ibm_lateral", name: "B.Tech. Computer Science and Engineering (Data Science) with academic support of IBM (Lateral)", level: "UG" },
      { id: "btech_cse_robotics_ai_ibm_ms", name: "B.Tech. Computer Science and Engineering (Robotics & AI) with Academic Support of IBM & powered by Microsoft Certifications", level: "UG" },
      { id: "bca_aiml_datascience_ibm_ms", name: "BCA (AI & Data Science) with academic support of IBM & powered by Microsoft Certifications", level: "UG" },
      { id: "bca_hons_aiml_datascience_ibm_ms", name: "BCA (Hons./ Hons. with Research) AI & Data Science with academic support of IBM & powered by Microsoft Certifications", level: "UG" },
      { id: "bca_cybersec_ec", name: "BCA (Cyber Security) with Academic Support of EC Council", level: "UG" },
      { id: "bca_hons_cybersec_ec", name: "BCA (Hons./ Hons. with Research) Cyber Security with Academic Support of EC Council", level: "UG" },
      { id: "bsc_hons_cs_ibm", name: "B.Sc. (Hons.) Computer Science with academic support of IBM", level: "UG" },
      { id: "bsc_hons_cybersec", name: "B.Sc. (Hons.) Cyber Security", level: "UG" },
      { id: "bsc_hons_datascience", name: "B.Sc. (Hons.) Data Science", level: "UG" },
      { id: "btech_it", name: "B.Tech Information Technology", level: "UG" },
      { id: "btech_ece", name: "B.Tech Electronics & Communication Engineering", level: "UG" },
      { id: "btech_me", name: "B.Tech Mechanical Engineering", level: "UG" },
      { id: "btech_ce", name: "B.Tech Civil Engineering", level: "UG" },
      { id: "btech_ee", name: "B.Tech Electrical Engineering", level: "UG" },
      { id: "mtech_automobile", name: "M.Tech. in Automobile Engineering", level: "PG" },
      { id: "mtech_cse", name: "M.Tech Computer Science & Engineering", level: "PG" },
      { id: "mtech_ece", name: "M.Tech Electronics & Communication Engineering", level: "PG" },
      { id: "mtech_me", name: "M.Tech Mechanical Engineering", level: "PG" },
      { id: "mca", name: "MCA", level: "PG" },
      { id: "mca_aiml_ibm_ms", name: "MCA (AI & ML) with academic support of IBM and powered by Microsoft Certifications", level: "PG" },
      { id: "phd", name: "Ph.D. (Engineering)", level: "PhD" },
    ],
  },
  {
    id: "som",
    name: "School of Management",
    courses: [
      { id: "bba_hr_marketing_finance_ib_tourism", name: "BBA (HR/ Marketing/ Finance/ International Business/ Travel & Tourism)", level: "UG" },
      { id: "bba_hons_hr_marketing_finance_ib_tourism", name: "BBA (Hons./ Hons with Research) (HR/ Marketing/ Finance/ International Business/ Travel & Tourism)", level: "UG" },
      { id: "bba_logistics_supplychain_safexpress", name: "BBA (Logistics and Supply Chain Management) with academic support of Safexpress", level: "UG" },
      { id: "bba_hons_logistics_supplychain_safexpress", name: "BBA (Hons./ Hons with Research) (Logistics and Supply Chain Management) with academic support of Safexpress", level: "UG" },
      { id: "bba_digital_marketing_iide", name: "BBA (Digital Marketing) with academic support of IIDE", level: "UG" },
      { id: "bba_hons_digital_marketing_iide", name: "BBA (Hons. / Hons. with Research) (Digital Marketing) with academic support of IIDE", level: "UG" },
      { id: "bba_business_analytics_ey", name: "BBA (Business Analytics) with academic support of Ernst & Young (EY)", level: "UG" },
      { id: "bba_hons_business_analytics_ey", name: "BBA (Hons./ Hons with Research) (Business Analytics) academic support of Ernst & Young (EY)", level: "UG" },
      { id: "bba_entrepreneurship_gcec", name: "BBA (Entrepreneurship) with academic support of GCEC Global Foundation", level: "UG" },
      { id: "bba_hons_entrepreneurship_gcec", name: "BBA (Hons./ Hons. with Research) (Entrepreneurship) with academic support of GCEC Global Foundation", level: "UG" },
      { id: "bba_international_accounting_finance_acca_grant_thornton", name: "BBA (International Accounting and Finance) (ACCA – UK) with academic support of Grant Thornton", level: "UG" },
      { id: "bba_hons_international_accounting_finance_acca_grant_thornton", name: "BBA (Hons. / Hons. with Research) (International Accounting and Finance) (ACCA – UK) with academic support of Grant Thornton", level: "UG" },
      { id: "mba_ibm", name: "MBA with Academic Support of IBM (Specialization in Human Resources/ Marketing/International Business/Finance and Business Analytics/Information Technology/Entrepreneurship)", level: "PG" },
      { id: "integrated_bba_mba_ibm", name: "Integrated BBA + MBA with Academic Support of IBM", level: "Integrated" },
      { id: "mba_digital_marketing_iide", name: "MBA (Digital Marketing) with academic support of IIDE", level: "PG" },
      { id: "mba_fintech_ey", name: "MBA (Fintech) with academic support of Ernst & Young (EY)", level: "PG" },
      { id: "mba_executive", name: "Executive MBA", level: "PG" },
      { id: "phd_management", name: "Ph.D. (Management)", level: "PhD" },
    ],
  },
  {
    id: "sol",
    name: "School of Law",
    courses: [
      { id: "llb", name: "LLB (Bachelor of Laws)", level: "UG" },
      { id: "ba_llb", name: "BA LLB (Integrated)", level: "Integrated" },
      { id: "llm", name: "LLM (Master of Laws)", level: "PG" },
    ],
  },
  {
    id: "soa",
    name: "School of Architecture",
    courses: [
      { id: "barch", name: "B.Arch (Bachelor of Architecture)", level: "UG" },
      { id: "march", name: "M.Arch (Master of Architecture)", level: "PG" },
    ],
  },
  {
    id: "sohss",
    name: "School of Humanities & Social Sciences",
    courses: [
      { id: "ba", name: "BA (Bachelor of Arts)", level: "UG" },
      { id: "bsc", name: "B.Sc", level: "UG" },
      { id: "ma", name: "MA (Master of Arts)", level: "PG" },
      { id: "msc", name: "M.Sc", level: "PG" },
    ],
  },
  {
    id: "sopa",
    name: "School of Performing Arts",
    courses: [
      { id: "bpa", name: "BPA (Bachelor of Performing Arts)", level: "UG" },
      { id: "mpa", name: "MPA (Master of Performing Arts)", level: "PG" },
    ],
  },
  {
    id: "soe",
    name: "School of Education",
    courses: [
      { id: "bed", name: "B.Ed (Bachelor of Education)", level: "UG" },
      { id: "med", name: "M.Ed (Master of Education)", level: "PG" },
    ],
  },
  {
    id: "soph",
    name: "School of Pharmacy",
    courses: [
      { id: "dpharm", name: "D.Pharm (Diploma in Pharmacy)", level: "Diploma" },
      { id: "bpharm", name: "B.Pharm (Bachelor of Pharmacy)", level: "UG" },
      { id: "mpharm", name: "M.Pharm (Master of Pharmacy)", level: "PG" },
    ],
  },
  {
    id: "soc",
    name: "School of Commerce",
    courses: [
      { id: "bcom_hons_international_accounting_finance_acca_grant_thornton", name: "B.Com. (Hons.) (International Accounting and Finance) (ACCA – UK) With academic support of Grant Thornton", level: "UG" },
      { id: "bcom_hons_research_international_accounting_finance_acca_grant_thornton", name: "B.Com. (Hons. / Hons. with Research) (International Accounting and Finance) (ACCA – UK) With academic support of Grant Thornton", level: "UG" },
      { id: "bcom_hons", name: "B.Com. (Hons.)", level: "UG" },
      { id: "bcom_hons_research", name: "B.Com. (Hons. / Hons. With Research)", level: "UG" },
      { id: "bcom_programme", name: "B.Com. Programme", level: "UG" },
      { id: "mcom", name: "M.Com (Master of Commerce)", level: "PG" },
    ],
  },
];

// ---------- Document Types ----------
export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: "policy", label: "Policy" },
  { value: "procedure", label: "Procedure" },
  { value: "notice", label: "Notice" },
  { value: "circular", label: "Circular" },
  { value: "guideline", label: "Guideline" },
  { value: "form", label: "Form" },
  { value: "directions", label: "Directions" },
  { value: "professor_details", label: "Professor Details" },
  { value: "other", label: "Other" },
];

// ---------- Academic Years ----------
export const ACADEMIC_YEARS = [
  "2025-2026",
  "2024-2025",
  "2023-2024",
  "2022-2023",
  "2021-2022",
];

// ---------- Suggested Questions ----------
export const SUGGESTED_QUESTIONS = [
  "What are the admission requirements?",
  "How do I apply for scholarships?",
  "What is the exam schedule?",
  "How can I contact the registrar office?",
];
