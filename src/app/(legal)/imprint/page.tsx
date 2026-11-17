import { legalMetadata } from "@/lib/legal/metadata";
import { operator } from "@/lib/legal/operator";
import { LegalPage, Section } from "../_components/LegalPage";
import { ContactEmail } from "../_components/Contact";

export const metadata = legalMetadata(
  "Imprint",
  "Who operates Aristo: name, place and contact details.",
  operator.imprintComplete,
  "/imprint",
);

/*
 * EDITORIAL (owner to confirm before this page is in force; none of this is legal advice):
 *  [I1] The field list (name, geographic address, email, object of the business) follows ECG s.5 and MedienG s.25 as
 *       summarised in findings/compliance.md 7.3; the statute texts were not checked in RIS.
 *  [I2] Whether a trade licence (Gewerbe), a chamber (WKO) membership or a UID number applies depends on whether the
 *       owner registers a trade. Nothing is stated here about any of them. If any applies, add them before launch.
 *  [I3] Showing a home address is the owner's decision; a business address or a c/o service can be used instead.
 *  [I4] The phone or second quick contact is not configured; add one if the owner wants it.
 */
export default function ImprintPage() {
  return (
    <LegalPage
      title="Imprint"
      inForce={operator.imprintComplete}
      missing={operator.missingForImprint}
      intro={<p>Information about the operator of this website and app, as required for services offered online in Austria.</p>}
    >
      <Section id="operator" title="Operator">
        <p>
          {operator.name ?? "[name not set]"}
          <br />
          {operator.address ?? "[postal address not set]"}
          <br />
          {operator.town ?? "[town not set]"}, {operator.country}
        </p>
        <p>
          Aristo is run by one individual. There is no company behind it.
        </p>
      </Section>

      <Section id="contact" title="Contact">
        <p>Email: <ContactEmail /></p>
        <p>
          Questions about your data, requests to see, correct or delete it, and reports of a problem with a lesson all go to
          this address.
        </p>
      </Section>

      <Section id="purpose" title="What the service is">
        <p>
          Aristo is a learning app for students in grades 6 to 8: an AI teacher in a 3D classroom explains topics, shows them on
          a board and checks understanding. It is a free early-access service. Paid plans are not offered yet.
        </p>
      </Section>

      <Section id="responsibility" title="Responsible for the content">
        <p>
          The operator named above. Lessons are written by AI systems and can contain mistakes (see the terms of use).
        </p>
      </Section>
    </LegalPage>
  );
}
