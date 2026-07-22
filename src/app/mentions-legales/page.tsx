export default function MentionsLegales() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Mentions Légales</h1>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Éditeur du Site</h2>
          <p className="text-gray-700">
            <strong>[À COMPLÉTER]</strong> : Raison sociale, RCCM/NIF, adresse Conakry, email contact
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Responsable de la Publication</h2>
          <p className="text-gray-700">
            <strong>[À COMPLÉTER]</strong> : Nom, fonction
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Hébergeur</h2>
          <p className="text-gray-700">
            <strong>[À COMPLÉTER]</strong> : Infrastructure de déploiement (cloud provider, données pays)
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Propriété Intellectuelle</h2>
          <p className="text-gray-700">
            Le contenu de MedConnecte (code, design, données) est protégé par les droits d'auteur.
            Toute reproduction sans autorisation est interdite.
          </p>
        </section>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-8">
          <p className="text-sm text-gray-600">
            <strong>TODO: Complément informations légales</strong> — À remplir par l'équipe juridique.
          </p>
        </div>
      </div>
    </div>
  );
}
