export default function CGU() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Conditions Générales d'Utilisation</h1>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Objet du Service</h2>
          <p className="text-gray-700 mb-4">
            MedConnecte est une plateforme numérique de partage de dossiers médicaux entre structures de santé
            et patients en Guinée.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Responsabilités des Utilisateurs</h2>
          <p className="text-gray-700 mb-4">
            Les patients consentent au partage de leurs données médicales uniquement avec des structures autorisées.
            Les structures s'engagent à utiliser les données uniquement à des fins de suivi médical.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Diagnostic IA — Disclaimer</h2>
          <p className="text-gray-700 mb-4 font-semibold text-red-600">
            ⚠️ Le diagnostic IA de MedConnecte est une aide à l'orientation uniquement.
            Il ne remplace <strong>EN AUCUN CAS</strong> un avis médical professionnel.
            Consultez toujours un médecin qualifié pour un diagnostic et traitement définitifs.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Limitations de Responsabilité</h2>
          <p className="text-gray-700 mb-4">
            <strong>[À COMPLÉTER]</strong> : Ajouter clauses de limitation de responsabilité, indemnisation,
            interruption de service.
          </p>
        </section>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-8">
          <p className="text-sm text-gray-600">
            <strong>TODO: Relecture juriste</strong> — CGU à compléter et valider avant usage public.
          </p>
        </div>
      </div>
    </div>
  );
}
