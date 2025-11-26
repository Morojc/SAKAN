import Link from "next/link";
import Pricing from "@/components/Pricing";
import SignIn from "@/components/sign-in";
import UserMenu from "@/components/user/UserMenu";
import { Building2, Users, Shield, Zap, CheckCircle2, ArrowRight, Star, TrendingUp, Wallet, Bell, FileText, BarChart3 } from "lucide-react";
import config from "@/config";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  const user = session?.user;
  
  const features = [
    {
      icon: Building2,
      title: "Gestion Complète des Résidences",
      description: "Gérez facilement toutes vos résidences, syndics et gardiens depuis une seule plateforme centralisée."
    },
    {
      icon: Users,
      title: "Gestion des Résidents",
      description: "Suivez et gérez tous vos résidents, leurs appartements et leurs informations en temps réel."
    },
    {
      icon: Wallet,
      title: "Gestion Financière",
      description: "Suivez les paiements, les charges, les dépenses et maintenez un contrôle total sur vos finances."
    },
    {
      icon: Shield,
      title: "Sécurité & Conformité",
      description: "Vos données sont protégées avec les meilleures pratiques de sécurité et conformité."
    },
    {
      icon: Bell,
      title: "Notifications Intelligentes",
      description: "Restez informé avec des notifications en temps réel pour les événements importants."
    },
    {
      icon: BarChart3,
      title: "Rapports & Analytics",
      description: "Analysez les performances et générez des rapports détaillés pour une meilleure prise de décision."
    }
  ];

  const benefits = [
    "Gain de temps considérable",
    "Réduction des erreurs administratives",
    "Amélioration de la communication",
    "Transparence totale",
    "Accès 24/7 depuis n'importe où"
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation Menu */}
      <nav className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Left side - Logo and navigation links */}
            <div className="flex items-center space-x-8">
              <Link href="/" className="flex items-center gap-2 text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                <Building2 className="h-7 w-7 text-indigo-600" />
                {config.appName}
              </Link>
              <div className="hidden md:flex space-x-6">
                <Link href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Fonctionnalités
                </Link>
                <Link href="#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Tarifs
                </Link>
                {user && (
                  <Link href="/app/" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                    Tableau de bord
                  </Link>
                )}
              </div>
            </div>

            {/* Right side - Auth buttons */}
            <div className="flex items-center gap-2">
              {user ? (
                <UserMenu />
              ) : (
                <div className="flex items-center">
                  <SignIn />
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-blue-50 py-20 lg:py-32">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-6">
              <Zap className="h-4 w-4" />
              <span>La solution de gestion immobilière nouvelle génération</span>
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              Gérez vos{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                résidences
              </span>{" "}
              en toute simplicité
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-2xl mx-auto">
              La plateforme tout-en-un pour les syndics, gardiens et résidents. 
              Simplifiez la gestion de vos immeubles avec des outils puissants et intuitifs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {!user ? (
                <>
                  <Link
                    href="/api/auth/signin"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold py-4 px-8 rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                  >
                    Commencer gratuitement
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                  <Link
                    href="#features"
                    className="inline-flex items-center gap-2 bg-white text-gray-700 font-semibold py-4 px-8 rounded-full border-2 border-gray-200 hover:border-gray-300 transition-all duration-200"
                  >
                    En savoir plus
                  </Link>
                </>
              ) : (
                <Link
                  href="/app/"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold py-4 px-8 rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  Accéder au tableau de bord
                  <ArrowRight className="h-5 w-5" />
                </Link>
              )}
            </div>
            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>Sans engagement</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>Essai gratuit</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>Support 24/7</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Une suite complète d'outils pour gérer efficacement vos résidences et vos résidents
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group p-8 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 hover:border-indigo-300 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gradient-to-br from-indigo-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Pourquoi choisir {config.appName}?
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Rejoignez des centaines de syndics qui font confiance à {config.appName} pour gérer leurs résidences.
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-full flex items-center justify-center mt-0.5">
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-lg text-gray-700">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-200">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-full flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Tableau de bord</h3>
                    <p className="text-gray-600">Vue d'ensemble en temps réel</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-indigo-600" />
                      <span className="font-medium">Résidents actifs</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900">150+</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Taux de satisfaction</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900">98%</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Documents traités</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900">1,200+</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Ce que disent nos clients
            </h2>
            <p className="text-xl text-gray-600">
              Rejoignez des centaines de syndics satisfaits
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Ahmed Benali",
                role: "Syndic, Résidence Les Jardins",
                content: "SAKAN a complètement transformé la façon dont je gère ma résidence. Tout est maintenant automatisé et transparent.",
                rating: 5
              },
              {
                name: "Fatima Alami",
                role: "Syndic, Complexe Résidentiel Al Andalous",
                content: "L'interface est intuitive et les fonctionnalités sont puissantes. Mes résidents adorent pouvoir suivre leurs paiements en temps réel.",
                rating: 5
              },
              {
                name: "Mohammed Tazi",
                role: "Gestionnaire, Résidence Atlas",
                content: "La meilleure décision que j'ai prise cette année. SAKAN m'a fait gagner des heures chaque semaine.",
                rating: 5
              }
            ].map((testimonial, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-2xl border border-gray-200 shadow-lg"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 leading-relaxed">
                  "{testimonial.content}"
                </p>
                <div>
                  <p className="font-semibold text-gray-900">{testimonial.name}</p>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 to-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Prêt à transformer la gestion de vos résidences?
          </h2>
          <p className="text-xl text-indigo-100 mb-8">
            Rejoignez {config.appName} aujourd&apos;hui et découvrez comment simplifier votre quotidien
          </p>
          {!user ? (
            <Link
              href="/api/auth/signin"
              className="inline-flex items-center gap-2 bg-white text-indigo-600 font-semibold py-4 px-8 rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
            >
              Commencer maintenant
              <ArrowRight className="h-5 w-5" />
            </Link>
          ) : (
            <Link
              href="/app/"
              className="inline-flex items-center gap-2 bg-white text-indigo-600 font-semibold py-4 px-8 rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
            >
              Accéder au tableau de bord
              <ArrowRight className="h-5 w-5" />
            </Link>
          )}
        </div>
      </section>

      {/* Pricing Section */}
      <Pricing />

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-6 w-6 text-indigo-400" />
                <span className="text-xl font-bold text-white">{config.appName}</span>
              </div>
              <p className="text-sm text-gray-400">
                La solution de gestion immobilière nouvelle génération
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Produit</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="#features" className="hover:text-white transition-colors">Fonctionnalités</Link></li>
                <li><Link href="#pricing" className="hover:text-white transition-colors">Tarifs</Link></li>
                <li><Link href="/api/auth/signin" className="hover:text-white transition-colors">Connexion</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white transition-colors">Documentation</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Centre d'aide</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Légal</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white transition-colors">Politique de confidentialité</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Conditions d'utilisation</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Cookies</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>© 2025 {config.appName}. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
