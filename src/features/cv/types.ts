// OpportunityOS – CV studio types.
// A CV is structured so it can be edited change by change and exported to Word or PDF.

export interface CvBullet {
  id: string;
  text: string;
}

export interface CvEntry {
  id: string;
  heading: string; // e.g. "English Tutor" or "The Hong Kong Polytechnic University"
  subheading?: string; // e.g. "Self-employed" or "BBA, Digital Finance and Investment"
  location?: string;
  dates?: string;
  bullets: CvBullet[];
}

export interface CvSection {
  id: string;
  title: string; // e.g. "Education", "Experience"
  entries: CvEntry[];
}

export interface CvDocument {
  name: string;
  contact: { email?: string; phone?: string; location?: string; links?: string[] };
  summary?: string;
  sections: CvSection[];
}

/** Everything the AI is allowed to use. Facts come from the CV, the student's answers, or what the student said in the chat. */
export interface Fact {
  id: string;
  text: string;
  source: "cv" | "student" | "profile";
}

export type CvChange =
  | { kind: "edit_bullet"; bulletId: string; newText: string; reason?: string }
  | { kind: "add_bullet"; entryId: string; newText: string; reason?: string }
  | { kind: "remove_bullet"; bulletId: string; reason?: string }
  | { kind: "move_section"; sectionId: string; toIndex: number; reason?: string }
  | { kind: "edit_summary"; newText: string; reason?: string };

export interface CheckedChange {
  id: string;
  change: CvChange;
  before: string | null;
  rejected: boolean; // removed: breaks the facts-only rule
  needsConfirmation: boolean; // shown unticked: mentions something not in the facts
  issues: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Answers from the guided builder for students without a CV. */
export interface BuilderEntry {
  title: string; // role, degree or project name
  organisation: string;
  location?: string;
  dates?: string;
  description: string; // one point per line, in the student's words
}

export interface BuilderAnswers {
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  links?: string;
  education: BuilderEntry[];
  experience: BuilderEntry[];
  activities: BuilderEntry[];
  projects: BuilderEntry[];
  skills?: string;
  languages?: string;
  awards?: string;
}
