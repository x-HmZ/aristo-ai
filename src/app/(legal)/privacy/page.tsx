import Link from "next/link";
import { PRIVACY_VERSION } from "@/lib/legal/documents";
import { legalMetadata } from "@/lib/legal/metadata";
import { operator } from "@/lib/legal/operator";
import { LegalPage, List, Rows, Section, legalLink } from "../_components/LegalPage";
import { ContactEmail } from "../_components/Contact";

export const metadata = legalMetadata(
  "Privacy policy",
  "What data Aristo collects, who receives it, how long it is kept and how to use your rights.",
  operator.complete,
  "/privacy",
);

/*
 * EDITORIAL MARKERS (owner to confirm or correct; collected in the build report; none of this is legal advice).
 * Each marker is placed next to the sentence it concerns, as [P#].
 *  [P1]  Controller is the individual named in the imprint, no company, no data protection officer (compliance.md 5.1).
 *  [P2]  "The server stores answers to quiz questions, including free-text answers" is read from quiz/submit; confirm
 *        it is still true at launch.
 *  [P3]  Retention periods are the PROPOSED schedule from compliance.md 7.1. No scheduled deletion job exists in the
 *        repo (grep found none). Either build the jobs or change the periods to what is actually done.
 *  [P4]  Supabase region is not discoverable from the repo. The text does not claim an EU region. Fill in, then say so.
 *  [P5]  Vercel function region is not set in vercel.json (default applies). Same.
 *  [P6]  Transfer basis: EU-US Data Privacy Framework "where the provider is certified, otherwise standard contractual
 *        clauses". Certification of Anthropic, OpenAI, fal.ai, ElevenLabs, Resend, Supabase, Vercel was NOT checked on
 *        dataprivacyframework.gov. Check each and accept each provider's data processing terms (docs/compliance/processors.md).
 *  [P7]  "Anthropic does not use API data to train its models by default": per findings; the provider's retention
 *        period is stated as 7 to 30 days by conflicting sources, so the page gives no number. Confirm and add.
 *  [P8]  OpenAI: embeddings of lesson-topic text; audio only if server voice recognition (NEXT_PUBLIC_STT_ENGINE=server)
 *        is switched on. Delete the voice sentence if that is never switched on.
 *  [P9]  Avaturn (custom teacher): its terms were not reviewed (LICENSES.md); the page states only what is sent.
 *  [P10] "Voice, free chat and the custom teacher are off for children until a parent switches them on" describes the
 *        recommended model (compliance.md section 6). Confirm the sign-up and account features built in parallel
 *        actually do this before this page is in force.
 *  [P11] Age rule "under 16 needs an account held by a parent or guardian": a uniform rule recommended in
 *        compliance.md (Austrian digital age of consent is 14, DSG s.4(4), not confirmed in RIS). Confirm the sign-up
 *        flow enforces it.
 *  [P12] "Download my data" and "Delete my account" in /account are built in parallel; confirm the labels and that
 *        they delete everything listed under Retention.
 *  [P13] Austrian data protection authority address and e-mail: Datenschutzbehörde, Barichgasse 40-42, 1030 Vienna,
 *        dsb@dsb.gv.at, from memory; confirm on dsb.gv.at.
 *  [P14] Paddle appears only as "when paid plans exist"; paid plans are not offered. Confirm Paddle as the processor.
 *  [P15] The legal bases (Art 6 GDPR) are the recommended ones in compliance.md 5.1; the legitimate-interest balancing
 *        test for security logs has not been written down.
 *  [P16] No cookie banner: only strictly necessary storage today (compliance.md 3.3). Re-check if analytics is added.
 *  [P17] Resend sends sign-up related emails; sender is still the Resend sandbox domain unless RESEND_FROM is set.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      version={PRIVACY_VERSION}
      inForce={operator.complete}
      missing={operator.missing}
      intro={
        <>
          <p>
            This explains what data Aristo handles, why, who else receives it, how long it is kept and what you can do about it.
            It is written for parents and guardians; the short version for children is in the box below.
          </p>
          <p>
            In this text, &ldquo;we&rdquo; means the operator named in the <Link href="/imprint" className={legalLink}>imprint</Link>,
            one individual.
          </p>
        </>
      }
    >
      <section aria-labelledby="kids" className="rounded-xl border border-line bg-surface p-4">
        <h2 id="kids" className="type-h4 font-bold">For children: the short version</h2>
        <p className="mt-2 text-sm leading-relaxed text-body">
          Aristo remembers your first name or nickname, what you answered in quizzes and how you learn, so your lessons fit you.
          Your teacher is an AI, not a person, and it can be wrong. Do not type your full name, address, phone number or
          anything private into Aristo. A grown-up who looks after you can ask to see or delete everything.
        </p>
      </section>

      <Section id="who" title="1. Who is responsible">
        {/* [P1] */}
        <p>
          The controller under the General Data Protection Regulation (GDPR) is the individual named in the{" "}
          <Link href="/imprint" className={legalLink}>imprint</Link>
          {operator.country ? `, based in ${operator.country}` : ""}. There is no company and no data protection officer.
          Contact for anything in this policy: <ContactEmail />.
        </p>
      </Section>

      <Section id="age" title="2. Who may use Aristo: children and parents">
        {/* [P11] */}
        <p>
          Aristo is made for students in grades 6 to 8, roughly ages 11 to 14. A person under 16 does not hold an account of
          their own. The account belongs to a parent or guardian, and the child learns through it. People aged 16 or older may
          open an account for themselves.
        </p>
        {/* [P10] */}
        <p>
          For children, these are off until the parent or guardian switches them on: voice input, free chat (typing any topic)
          and the custom teacher made from photos. Nothing a child types is used for advertising, and there is no advertising
          in Aristo at all.
        </p>
        <p>
          A parent or guardian can see what is stored about the child, download it, correct it, delete it and stop further
          collection at any time (see section 11).
        </p>
      </Section>

      <Section id="collect" title="3. What we collect, and why">
        {/* [P15] bases are the recommended ones */}
        <Rows
          rows={[
            {
              term: "Account data",
              body: (
                <>
                  Email address, a password (stored only as a hash by our sign-in provider), a name or nickname, and your
                  learning goal and daily time if you enter them. Purpose: to run your account and sign you in. Basis: contract
                  (Art 6(1)(b) GDPR).
                </>
              ),
            },
            {
              term: "Learning data",
              body: (
                <>
                  {/* [P2] */}
                  Which topics you studied, your mastery per concept and when to review it again, your answers to quiz questions
                  (including free-text answers), the feedback you were given, mistakes the quiz detected, and course progress.
                  Purpose: to teach, to score quizzes and to schedule reviews. Basis: contract.
                </>
              ),
            },
            {
              term: "Learning profile",
              body: (
                <>
                  Aristo adjusts four things from how you use it: how much background to assume, how deep to go, the pace, and
                  the kind of example. It works this out with fixed rules from time spent on parts of a lesson, clicks, and
                  quiz accuracy. It does not use a camera, location or voice analysis, it does not guess feelings, and an AI
                  model does not make this decision. It only changes how a lesson is explained. It never decides whether you
                  may use Aristo, and no one is ranked or graded by it. Basis: contract; this adjustment is the service
                  itself. A parent can ask us to turn it off.
                </>
              ),
            },
            {
              term: "What you type or say to the teacher",
              body: (
                <>
                  Topics you ask about and answers you write are sent to the AI provider that writes the lesson (section 5).
                  If you use voice input, see section 6. Please do not type personal details.
                </>
              ),
            },
            {
              term: "Technical and safety data",
              body: (
                <>
                  IP address and request logs kept by our hosting and database providers, a record of AI requests (which
                  feature, how many tokens, what it cost, and the topic of a request) for cost control and abuse prevention,
                  and a log of administrator actions. Basis: our legitimate interest in security and in keeping the
                  free service affordable (Art 6(1)(f)).
                </>
              ),
            },
            {
              term: "Emails",
              body: (
                <>
                  Messages needed to run the account, such as sign-in confirmation and, while accounts are approved by hand, a
                  notice when yours is approved. We send no marketing email.
                </>
              ),
            },
          ]}
        />
      </Section>

      <Section id="storage" title="4. Cookies and storage on your device">
        {/* [P16] */}
        <p>
          Aristo uses only what it needs to work: the sign-in session cookie, your light or dark theme choice, and session
          storage that keeps your place in a lesson until you close the tab. There is no analytics, no advertising and no
          tracking, so there is no cookie banner. Fonts are delivered by Aristo itself, not by a third party.
        </p>
      </Section>

      <Section id="recipients" title="5. Who else receives data (processors)">
        {/* [P4] [P5] [P6] */}
        <p>
          We use the services below to run Aristo. They act on our instructions. Each receives only what its job needs. We do
          not sell data and we do not share it for advertising. We never send your name or email to an AI provider.
        </p>
        <Rows
          rows={[
            {
              term: "Supabase: database, sign-in and file storage",
              body: "Receives everything in section 3 that we store, plus generated pictures, 3D models and narration files (these are lesson content, not personal data).",
            },
            {
              term: "Vercel: hosting",
              body: "Serves the website and runs our server code. Sees every request, including IP addresses and server logs.",
            },
            {
              term: "Anthropic: writes lessons and checks answers",
              body: (
                <>
                  {/* [P7] */}
                  Receives the topic or concept, the learner&apos;s level settings, reference text for the lesson, and the
                  free-text answers and topics you type. It does not receive your name or email. Anthropic states that it does not
                  train its models on data sent through its business API by default; it keeps requests for a limited time
                  under its own terms.
                </>
              ),
            },
            {
              term: "OpenAI: search over lesson reference material",
              body: (
                <>
                  {/* [P8] */}
                  Receives short pieces of lesson text (concept names and search queries) to turn into numbers for finding
                  reference material. No personal data is intended. If server-side voice recognition is switched on, it
                  would also receive the audio of what you say, for transcription only.
                </>
              ),
            },
            {
              term: "fal.ai: pictures and 3D models",
              body: "Receives a short description of what to draw or model, written by the AI from the lesson topic. A topic you typed yourself can appear in it. No name or email.",
            },
            {
              term: "ElevenLabs: the teacher's voice",
              body: "Receives the lesson sentences to turn into speech. Lesson text only; no name or email. A topic you typed yourself can appear in it.",
            },
            {
              term: "Resend: email delivery",
              body: "Receives the recipient address, name and message text of the emails described above.",
            },
            {
              term: "Avaturn: custom teacher (optional)",
              body: (
                <>
                  {/* [P9] */}
                  Only if you use &ldquo;Create yours&rdquo;. The photos you provide are processed by Avaturn in an embedded
                  window to build a 3D avatar. Off for children unless a parent switches it on.
                </>
              ),
            },
            {
              term: "Google: voice recognition in some browsers (not our processor)",
              body: "See section 6.",
            },
            {
              term: "Paddle: payments (only when paid plans exist)",
              body: (
                <>
                  {/* [P14] */}
                  Paid plans are not offered yet, so no payment data is collected. If they are, Paddle will process payments as
                  the seller and we will update this policy first.
                </>
              ),
            },
          ]}
        />
        <p>
          <strong className="text-ink">Transfers outside the EU.</strong> Several of these providers are in, or process data in,
          the United States. We rely on the EU-US Data Privacy Framework where the provider is certified, and otherwise on the
          EU standard contractual clauses in the provider&apos;s data processing terms.
        </p>
      </Section>

      <Section id="voice" title="6. Voice input">
        <p>
          Voice input is optional and off for children until a parent switches it on. It turns on only when you press the
          microphone button. In browsers that offer speech recognition (Chrome and others), the browser itself sends the audio
          to its speech service, which in Chrome is run by Google. Aristo never receives that audio, only the text it turns
          into. That text is handled like anything you type. The browser maker&apos;s own privacy terms apply to the audio.
          If you prefer, type your answer instead.
        </p>
      </Section>

      <Section id="retention" title="7. How long we keep data">
        {/* [P3] proposed schedule, no deletion jobs exist yet */}
        <List>
          <li>Account, learning data and learning profile: until the account is deleted.</li>
          <li>Accounts not signed in to for 24 months: deleted after a warning email.</li>
          <li>Session logs (time and clicks per lesson): 12 months.</li>
          <li>Free-text quiz answers: 12 months, then blanked; the score stays.</li>
          <li>Record of AI requests: 90 days, without the topic text.</li>
          <li>Administrator action log: 12 months; a deleted person&apos;s name is removed from it when the account is deleted.</li>
          <li>Backups: removed when the database provider&apos;s backup window expires after deletion.</li>
          <li>Invoices, once paid plans exist: as long as tax law requires.</li>
        </List>
      </Section>

      <Section id="security" title="8. Security">
        <p>
          Learner data is stored with row-level access rules so each account can read only its own rows, administrator access is
          limited to the operator, and connections are encrypted. If a personal data breach puts you at risk we will tell the
          supervisory authority within 72 hours and tell affected people without undue delay.
        </p>
      </Section>

      <Section id="ai" title="9. AI and automated decisions">
        <p>
          The teacher is an artificial intelligence system. Lessons and quiz feedback are generated by AI language models and can
          be wrong, out of date or incomplete. Aristo is not a substitute for a teacher, a school or a textbook. No decision
          with legal or similarly significant effect is made about anyone, and nothing in Aristo is used to admit, place,
          grade or rank students.
        </p>
      </Section>

      <Section id="rights" title="10. Your rights">
        <p>
          You have the right to access, correct, delete, restrict and object to the processing of your data, and to receive it in
          a portable format. Where a parent or guardian acts for a child, they exercise these rights for the child.
        </p>
        <List>
          {/* [P12] */}
          <li>
            Self-service in <Link href="/account" className={legalLink}>your account</Link>: &ldquo;Download my data&rdquo; and
            &ldquo;Delete my account&rdquo;.
          </li>
          <li>Anything else, or if you cannot sign in: write to <ContactEmail />. We answer within one month.</li>
        </List>
        <p>
          You may withdraw a consent at any time, with effect for the future. You also have the right to complain to the
          supervisory authority. In Austria that is the Datenschutzbehörde (Austrian Data Protection Authority), Barichgasse
          40-42, 1030 Vienna,{" "}
          <a href="https://www.dsb.gv.at" className={legalLink} target="_blank" rel="noopener noreferrer">dsb.gv.at</a>
          {/* [P13] */}.
        </p>
      </Section>

      <Section id="us" title="11. Parents and guardians in more detail">
        <p>
          A parent or guardian may at any time review what is stored about their child, ask for it to be corrected or deleted,
          withdraw consent, and ask us to stop collecting further data. We collect only what the lessons need and we do not make
          a child&apos;s access depend on providing more. The short notice for parents is on the{" "}
          <Link href="/parents" className={legalLink}>parents page</Link>.
        </p>
      </Section>

      <Section id="changes" title="12. Changes">
        <p>
          When this policy changes in substance, its date at the top changes and we ask for acceptance again where the law
          requires it. Earlier versions can be requested from <ContactEmail />.
        </p>
      </Section>
    </LegalPage>
  );
}
