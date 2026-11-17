import Link from "next/link";
import { PARENTS_NOTICE_VERSION } from "@/lib/legal/documents";
import { legalMetadata } from "@/lib/legal/metadata";
import { operator } from "@/lib/legal/operator";
import { LegalPage, List, Section, legalLink } from "../_components/LegalPage";
import { ContactEmail } from "../_components/Contact";

export const metadata = legalMetadata(
  "For parents and guardians",
  "A short notice for parents and guardians: what Aristo is, what it keeps and what you control.",
  operator.complete,
  "/parents",
);

/*
 * EDITORIAL MARKERS (owner to confirm or correct; none of this is legal advice):
 *  [K1] This summarises the privacy policy (markers P1-P17 there apply). It is the short notice recommended for parents in
 *       compliance.md 7.4. For US children, COPPA (16 CFR 312.4) wants a direct notice before data is collected and
 *       verifiable parental consent; this page is not that consent flow.
 *  [K2] The off-by-default list (voice, free chat, custom teacher) depends on the parent controls built in parallel;
 *       confirm they exist and default off before this page is in force.
 *  [K3] "Your child's first name or nickname": the sign-up form currently asks for a full name; confirm the final form.
 */
export default function ParentsPage() {
  return (
    <LegalPage
      title="For parents and guardians"
      version={PARENTS_NOTICE_VERSION}
      inForce={operator.complete}
      missing={operator.missing}
      intro={<p>The short version of what you need to know before your child uses Aristo. The details are in the <Link href="/privacy" className={legalLink}>privacy policy</Link>.</p>}
    >
      <Section id="ai" title="The teacher is an AI">
        <p>
          Your child learns from an artificial intelligence system, shown as a 3D teacher. It explains out loud, draws on the
          board and asks quiz questions. It is not a person. It can be wrong, and it is not a substitute for a school teacher. Every
          lesson says so. Please learn alongside your child and check anything that matters.
        </p>
      </Section>

      <Section id="data" title="What Aristo keeps">
        {/* [K3] */}
        <List>
          <li>Your email and your child&apos;s first name or nickname.</li>
          <li>What your child studied, their quiz answers (including written ones), the mistakes the quiz noticed, and when topics are due for review.</li>
          <li>A learning profile: pace, depth and the kind of example that suits your child, worked out by fixed rules from time spent and quiz results. It only changes how a lesson is explained.</li>
          <li>Technical logs and a record of AI requests, kept for security and cost control.</li>
        </List>
        <p>
          Aristo uses no camera and no location, shows no advertising, sells nothing and sends no marketing email. What your
          child types or says is sent to the AI services that write the lesson (never with a name or email); the privacy
          policy names each one.
        </p>
      </Section>

      <Section id="controls" title="What you control">
        {/* [K2] */}
        <List>
          <li>Children under 16 use an account held by a parent or guardian.</li>
          <li>Voice input, free chat (typing any topic) and the custom teacher made from photos are off until you switch them on. If voice is on, the browser, in Chrome run by Google, sends the audio to its speech service. Aristo only receives the text.</li>
          <li>
            In <Link href="/account" className={legalLink}>your account</Link> you can download everything stored and delete it,
            and you can ask us to correct it or to stop collecting more.
          </li>
          <li>Write to <ContactEmail /> for anything else. We answer within one month.</li>
        </List>
      </Section>

      <Section id="more" title="More">
        <p>
          The <Link href="/terms" className={legalLink}>terms of use</Link> and the{" "}
          <Link href="/imprint" className={legalLink}>imprint</Link> say who runs Aristo and on what terms. Aristo is a free
          early-access service and paid plans are not offered yet. You can complain to your data protection authority; in
          Austria that is the Datenschutzbehörde (<a href="https://www.dsb.gv.at" className={legalLink} target="_blank" rel="noopener noreferrer">dsb.gv.at</a>).
        </p>
      </Section>
    </LegalPage>
  );
}
