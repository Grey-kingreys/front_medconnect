/**
 * MedConnect — Site Configuration (Frontend)
 *
 * Configuration globale de l'application web React.
 * Centralise toutes les constantes de l'app : métadonnées,
 * URLs d'API, feature flags, rôles, navigation, etc.
 *
 * Usage :
 *   import { siteConfig } from '@/config/site.config'
 */

// ─── ENVIRONNEMENT ────────────────────────────────────────────────────────────

const ENV = import.meta.env.MODE // 'development' | 'production' | 'test'

// ─── CONFIG PRINCIPALE ────────────────────────────────────────────────────────

export const siteConfig = {

    // ─── Métadonnées de l'application ──────────────────────────────────────────

    app: {
        name: 'MedConnect',
        tagline: 'Votre santé à portée de main',
        description: 'Application web et mobile pour la gestion de santé numérique, l\'accès aux soins et l\'assistance médicale d\'urgence.',
        version: '1.0.0',
        locale: 'fr-GN',               // Guinée — français
        currency: 'GNF',                 // Franc Guinéen
        supportEmail: 'support@medconnect.gn',
        website: 'https://medconnect.gn',
    },

    // ─── API Backend ────────────────────────────────────────────────────────────

    api: {
        baseUrl: ENV === 'production'
            ? 'https://api.medconnect.gn'
            : 'http://localhost:3000',

        timeout: 10_000,   // 10 secondes
        version: 'v1',

        // Endpoints principaux
        endpoints: {
            // Auth
            login: '/auth/login',
            register: '/auth/register',
            logout: '/auth/logout',
            refreshToken: '/auth/refresh',
            forgotPassword: '/auth/forgot-password',
            resetPassword: '/auth/reset-password',
            me: '/auth/me',

            // Patients
            patients: '/patients',
            patientById: (id: string) => `/patients/${id}`,

            // Dossier médical
            medicalRecord: '/medical-records',
            medicalRecordById: (id: string) => `/medical-records/${id}`,
            prescriptions: '/prescriptions',
            allergies: '/allergies',
            vaccinations: '/vaccinations',
            labResults: '/lab-results',

            // Géolocalisation
            hospitals: '/places/hospitals',
            pharmacies: '/places/pharmacies',
            clinics: '/places/clinics',
            nearbyPlaces: '/places/nearby',

            // Pharmacie / Médicaments
            medications: '/medications',
            medicationById: (id: string) => `/medications/${id}`,
            medicationSearch: '/medications/search',

            // IA Diagnostic
            aiDiagnosis: '/ai/diagnosis',
            aiChat: '/ai/chat',

            // Urgence
            sos: '/emergency/sos',
            emergencyContacts: '/emergency/contacts',

            // Notifications / Alertes
            notifications: '/notifications',
            markNotificationRead: (id: string) => `/notifications/${id}/read`,

            // Rendez-vous
            appointments: '/appointments',
            appointmentById: (id: string) => `/appointments/${id}`,

            // Hôpitaux / Établissements (tableau de bord pro)
            facilities: '/facilities',
            facilityById: (id: string) => `/facilities/${id}`,
        },
    },

    // ─── Google Maps ────────────────────────────────────────────────────────────

    maps: {
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
        defaultCenter: {
            lat: 9.5370,   // Conakry, Guinée
            lng: -13.6773,
        },
        defaultZoom: 13,
        searchRadius: 5000, // rayon de recherche géo en mètres (5 km)
    },

    // ─── Authentification ───────────────────────────────────────────────────────

    auth: {
        tokenKey: 'medconnect_access_token',
        refreshTokenKey: 'medconnect_refresh_token',
        userKey: 'medconnect_user',
        tokenExpiry: 15 * 60,          // 15 minutes (secondes)
        refreshExpiry: 7 * 24 * 60 * 60, // 7 jours (secondes)
        redirectAfterLogin: '/dashboard',
        redirectAfterLogout: '/login',
    },

    // ─── Rôles utilisateurs ─────────────────────────────────────────────────────

    roles: {
        PATIENT: 'patient',
        HOSPITAL: 'hospital',
        PHARMACY: 'pharmacy',
        ADMIN: 'admin',
    } as const,

    // ─── Navigation principale ──────────────────────────────────────────────────
    // (onglets bottom nav — correspond aux maquettes)

    navigation: {
        bottomNav: [
            { key: 'home', label: 'Accueil', path: '/dashboard', icon: 'Home' },
            { key: 'dossier', label: 'Dossier', path: '/dossier', icon: 'FileText' },
            { key: 'search', label: 'Rechercher', path: '/recherche', icon: 'MapPin' },
            { key: 'sos', label: 'SOS', path: '/sos', icon: 'Heart' },
            { key: 'alerts', label: 'Alertes', path: '/alertes', icon: 'Bell' },
        ],
        // Routes publiques (sans authentification)
        publicRoutes: ['/login', '/register', '/forgot-password', '/reset-password', '/onboarding'],
    },

    // ─── Feature Flags ──────────────────────────────────────────────────────────
    // Activer / désactiver des fonctionnalités selon l'avancement du projet

    features: {
        aiDiagnosis: true,   // Diagnostic IA activé
        geolocation: true,   // Géolocalisation médicale
        sosEmergency: true,   // Bouton SOS d'urgence
        pharmacyStock: true,   // Consultation stock pharmacie en temps réel
        teleconsultation: false,  // Téléconsultation (fonctionnalité premium — à venir)
        offlineMode: false,  // Mode hors-ligne partiel (mobile — à venir)
        pushNotifications: true,   // Notifications push
        medicalRecordShare: false,  // Partage de dossier entre praticiens (à venir)
    },

    // ─── Pagination ─────────────────────────────────────────────────────────────

    pagination: {
        defaultPageSize: 10,
        pageSizeOptions: [10, 20, 50],
    },

    // ─── Upload fichiers ────────────────────────────────────────────────────────

    upload: {
        maxSizeMb: 10,
        acceptedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
        acceptedDocTypes: ['application/pdf'],
        acceptedAll: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    },

    // ─── Urgence — numéros locaux (Guinée) ─────────────────────────────────────

    emergency: {
        samu: '444',
        police: '117',
        pompiers: '18',
        default: '444',
    },

    // ─── SEO / Meta par défaut ──────────────────────────────────────────────────

    seo: {
        defaultTitle: 'MedConnect — Votre santé à portée de main',
        titleTemplate: '%s | MedConnect',
        defaultDescription: 'Accédez à vos soins, localisez des hôpitaux et pharmacies, et obtenez une assistance médicale d\'urgence grâce à MedConnect.',
        themeColor: '#5B5BD6',
        ogImage: '/og-image.png',
    },

} as const

export type SiteConfig = typeof siteConfig
export type UserRole = typeof siteConfig.roles[keyof typeof siteConfig.roles]