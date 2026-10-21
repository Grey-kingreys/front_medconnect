export default function RGPD() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Conformité RGPD</h1>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Vos Droits RGPD</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li><strong>Droit d'accès</strong> : Consulter vos données traitées</li>
            <li><strong>Droit de rectification</strong> : Corriger vos informations</li>
            <li><strong>Droit à l'oubli</strong> : Demander la suppression (sous conditions)</li>
            <li><strong>Droit à la limitation</strong> : Limiter le traitement</li>
            <li><strong>Droit à la portabilité</strong> : Récupérer vos données</li>
            <li><strong>Droit d'opposition</strong> : Refuser certains traitements</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Base Légale du Traitement</h2>
          <p className="text-gray-700 mb-4">
            MedConnecte traite vos données de santé sur la base de :
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>Votre consentement explicite à partager votre dossier</li>
            <li>L'intérêt légitime du suivi médical de qualité</li>
            <li>Les obligations légales de confidentialité médical</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Exercer Vos Droits</h2>
          <p className="text-gray-700">
            Pour exercer vos droits RGPD, envoyez une demande écrite à :
          </p>
          <p className="text-gray-700 mt-2 font-semibold">
            contact@medconnecte.com
          </p>
          <p className="text-gray-700 mt-4">
            Nous traiterons votre demande dans un délai de 30 jours.
          </p>
        </section>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-8">
          <p className="text-sm text-gray-600">
            <strong>Note</strong> : Cette page renvoie à la confidentialité pour des détails complets.
            Consultez <a href="/confidentialite" className="text-blue-600 hover:underline">notre politique de confidentialité</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
