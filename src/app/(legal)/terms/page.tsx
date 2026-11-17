import Link from "next/link";
import { TERMS_VERSION } from "@/lib/legal/documents";
import { legalMetadata } from "@/lib/legal/metadata";
import { operator } from "@/lib/legal/operator";
import { LegalPage, List, Section, legalLink } from "../_components/LegalPage";
import { ContactEmail } from "../_components/Contact";

export const metadata = legalMetadata(
  "Terms of use",
  "The rules for using Aristo, a free early-access AI learning service.",
  operator.complete,
  "/terms",
);

/*
 * EDITORIAL MARKERS (owner to confirm or correct; none of this is legal advice):
 *  [T1] Minimum ages (18 to hold an account for a child, 16 to learn alone) follow the recommended model in
 *       compliance.md section 6, not a rule confirmed in Austrian law.
 *  [T2] "Free early-access service, no contract for payment" assumes no money changes hands. Once paid plans exist the
 *       terms need a paid section (price, renewal, cancellation, withdrawal rights under FAGG, button solution).
 *  [T3] Liability wording: no exclusion for intent, gross negligence or injury, as mandatory under Austrian consumer law
 *       (KSchG s.6, s.9 ABGB). A lawyer should confirm the limitation for slight negligence.
 *  [T4] Governing law and venue: Austrian law, consumer's mandatory home-country rights preserved (Rome I Art 6).
 *       Whether an out-of-court dispute resolution notice (AStG / ODR platform) is needed before consumer contracts exist
 *       is unconfirmed.
 *  [T5] "Not for formal assessment, admission, placement or grading" supports the EU AI Act classification
 *       (compliance.md 5.4). Keep it true: no school or teacher use without reassessing.
 *  [T6] Approval-by-hand sentence follows NEXT_PUBLIC_ACCESS_MODE; the monthly free allowance numbers are plan data and
 *       are deliberately not stated here.
 *  [T7] Third-party content: avatars are CC BY 4.0 (LICENSES.md), reference material per /credits.
 *  [T8] Termination and suspension rights are a standard draft, not reviewed.
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      version={TERMS_VERSION}
      inForce={operator.complete}
      missing={operator.missing}
      intro={
        <p>
          These terms apply when you use Aristo. They are written in plain language on purpose. How we handle data is in the{" "}
          <Link href="/privacy" className={legalLink}>privacy policy</Link>.
        </p>
      }
    >
      <Section id="who" title="1. Who offers Aristo">
        <p>
          Aristo is offered by the individual named in the <Link href="/imprint" className={legalLink}>imprint</Link>. Contact:{" "}
          <ContactEmail />. Aristo is a free early-access service. Paid plans are not offered yet; if they are, they will have
          their own terms that you accept before paying.
        </p>
      </Section>

      <Section id="accounts" title="2. Accounts">
        {/* [T1] */}
        <List>
          <li>An account belongs to one adult. To open an account for a child you must be at least 18 and the child&apos;s parent or legal guardian.</li>
          <li>People aged 16 or older may open an account to learn for themselves.</li>
          <li>The parent or guardian is responsible for what the child does with the account.</li>
          <li>Keep your password to yourself and do not share the account. Tell us if you think someone else has used it.</li>
          <li>You give us correct details. We may refuse, suspend or close accounts that break these terms.</li>
        </List>
        {/* [T6] the approval wording is on the landing page and follows the access mode */}
      </Section>

      <Section id="service" title="3. What Aristo is, and what it is not">
        <p>
          Aristo is a study aid. An artificial intelligence system plays the teacher: it writes the lessons, the pictures and the
          quiz feedback. <strong className="text-ink">It can make mistakes.</strong> It is not a human teacher and not a substitute
          for a school, a teacher or a textbook. Check anything important, and anything you would quote, with a reliable source.
        </p>
        {/* [T5] */}
        <p>
          Aristo is not for formal assessment, grading, school admission, placement or certification, and its results do not
          count as such. It is not for emergencies or for personal, medical or legal advice. If you or a child need help
          urgently, talk to a trusted adult or the local emergency number.
        </p>
      </Section>

      <Section id="allowance" title="4. Free allowance and availability">
        {/* [T2] [T6] */}
        <p>
          Use is free, within an allowance that can limit how many lessons a month you can generate. Showing the limit and what
          happens when it is reached is part of the service. Aristo is early access: features may change, be paused or be
          withdrawn, and it may be unavailable at times, for example when a provider we depend on is down or to keep costs
          under control. We will not charge you for anything without your clear agreement first.
        </p>
      </Section>

      <Section id="use" title="5. Acceptable use">
        <List>
          <li>Do not type personal details about yourself or other people (full names, addresses, phone numbers, school names).</li>
          <li>Do not try to make the teacher produce harmful, hateful, sexual or dangerous content, or to get around its limits.</li>
          <li>Do not attack, overload, scrape or reverse engineer the service, and do not use it to build another AI service.</li>
          <li>Do not use another person&apos;s account.</li>
        </List>
        <p>
          If you break these rules we may stop a lesson, suspend the account or close it. If you see something wrong in a
          lesson, use &ldquo;Report a problem&rdquo; (in the lesson menu and the page footer) or write to <ContactEmail />.
        </p>
      </Section>

      <Section id="content" title="6. Content and licences">
        {/* [T7] */}
        <p>
          Lessons are generated for you and are for your own learning. Teacher models, reference material and other
          third-party works keep their own licences and are credited on the{" "}
          <Link href="/credits" className={legalLink}>credits page</Link>. What you type stays yours; you let us process it to run
          the service as the privacy policy describes.
        </p>
      </Section>

      <Section id="liability" title="7. No warranty, and liability">
        {/* [T3] */}
        <p>
          Because the service is free and AI-generated, we do not promise that it is complete, correct, uninterrupted or fit for a
          particular purpose. We are liable without limit for intent and gross negligence and for injury to life, body or health,
          and wherever mandatory law, including Austrian consumer protection law, does not allow us to limit liability. Beyond
          that, our liability for slight negligence is excluded as far as the law permits. Your statutory consumer rights are
          not affected.
        </p>
      </Section>

      <Section id="changes" title="8. Changes and ending">
        {/* [T8] */}
        <p>
          We may change these terms; the date at the top changes when the meaning does, and we ask again where the law requires
          it. You can stop using Aristo and delete your account at any time in{" "}
          <Link href="/account" className={legalLink}>your account</Link>, which deletes your data as the privacy policy describes.
          We may end the service or an account with reasonable notice, or immediately for a serious breach.
        </p>
      </Section>

      <Section id="law" title="9. Law and complaints">
        {/* [T4] */}
        <p>
          Austrian law applies. If you are a consumer in another country, the mandatory consumer protection rules of the country
          where you live still apply to you. Please write to <ContactEmail /> first if something is wrong; we will answer.
        </p>
      </Section>
    </LegalPage>
  );
}
