export default function Confidentialite() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Politique de Confidentialité</h1>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Données Personnelles</h2>
          <p className="text-gray-700 mb-4">
            MedConnecte collecte et traite vos données personnelles (identité, contact, données médicales)
            conformément au RGPD.
          </p>
          <p className="text-gray-700 mb-4">
            <strong>[À COMPLÉTER]</strong> : Compléter avec détails juridiques, responsable de données,
            bases légales, droits des utilisateurs.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Sécurité des Données Médicales</h2>
          <p className="text-gray-700 mb-4">
            Les données de santé sont chiffrées en transit et au repos (AES-256-GCM). Accès auditée et contrôlée
            par permissions.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Droits de l'Utilisateur</h2>
          <p className="text-gray-700 mb-4">
            Vous avez le droit d'accéder, rectifier, supprimer ou porter vos données.
            Contactez-nous à contact@medconnecte.com pour exercer ces droits.
          </p>
        </section>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-8">
          <p className="text-sm text-gray-600">
            <strong>TODO: Relecture juriste</strong> — Cette page nécessite une revue légale avant déploiement public.
          </p>
        </div>
      </div>
    </div>
  );
}
