'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { 
  ArrowRight, Building2, Users, Wallet, Zap, 
  BarChart3, Layers, Menu, X, 
  ChevronRight
} from 'lucide-react'
import config from '@/config'
import UserMenu from '@/components/user/UserMenu'
import SignIn from '@/components/sign-in'
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher'

// --- UI Components ---

const Button = ({ children, variant = 'primary', className = '', href }: { children: React.ReactNode, variant?: 'primary' | 'secondary' | 'outline' | 'white', className?: string, href?: string }) => {
  const baseStyle = "inline-flex items-center justify-center px-6 py-3 rounded-full font-medium transition-all duration-200 text-sm tracking-wide"
  const variants = {
    primary: "bg-black text-white hover:bg-gray-800 border border-black",
    secondary: "bg-[#F3F3F3] text-black hover:bg-gray-200 border border-transparent",
    outline: "bg-transparent text-black border border-black hover:bg-black hover:text-white",
    white: "bg-white text-black hover:bg-gray-100 border border-white"
  }

  if (href) {
    return <Link href={href} className={`${baseStyle} ${variants[variant]} ${className}`}>{children}</Link>
  }
  return <button className={`${baseStyle} ${variants[variant]} ${className}`}>{children}</button>
}

// --- Sections ---

const Navbar = ({ user }: { user: any }) => {
  const [isScrolled, setIsScrolled] = React.useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'py-4 bg-[#F3F3F3]/80 backdrop-blur-md border-b border-gray-200' : 'py-6 bg-transparent'}`}>
      <div className="max-w-[1400px] mx-auto px-6 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-2xl font-bold tracking-tighter flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white">
              <Building2 size={16} />
            </div>
            {config.appName.toUpperCase()}
          </Link>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link href="#features" className="hover:text-black transition-colors">Solutions</Link>
            <Link href="#use-cases" className="hover:text-black transition-colors">Cas d'usage</Link>
            <Link href="#pricing" className="hover:text-black transition-colors">Tarifs</Link>
            <Link href="#company" className="hover:text-black transition-colors">À propos</Link>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <LanguageSwitcher />
          {user ? (
            <UserMenu />
          ) : (
            <>
              <SignIn />
              <Button href="/api/auth/signin" variant="primary" className="py-2 px-5 text-xs uppercase">
                Commencer
              </Button>
            </>
          )}
        </div>

        <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 w-full bg-white border-b border-gray-200 p-6 md:hidden flex flex-col gap-4"
          >
            <Link href="#features" className="text-lg font-medium">Solutions</Link>
            <Link href="#use-cases" className="text-lg font-medium">Cas d'usage</Link>
            <Link href="#pricing" className="text-lg font-medium">Tarifs</Link>
            <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
              <div className="flex justify-center">
                <LanguageSwitcher />
              </div>
              <SignIn />
              <Button href="/api/auth/signin" variant="primary" className="w-full justify-center">Commencer</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}

const Hero = () => {
  return (
    <section className="bg-[#F3F3F3] min-h-screen pt-32 pb-20 px-6 relative overflow-hidden flex items-center">
      <div className="max-w-[1400px] mx-auto w-full grid lg:grid-cols-2 gap-12 items-center">
        <div className="z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] mb-8 text-black uppercase">
              Copilote<br/>Intelligent<br/>Pour Votre<br/>Immeuble
            </h1>
            <p className="text-lg md:text-xl text-gray-600 max-w-lg mb-10 leading-relaxed">
              Les applications dont vous dépendez, le support que vous méritez, et l'IA que vous attendiez - tout en une seule plateforme unifiée.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button href="/api/auth/signin" variant="primary" className="h-14 px-8 text-base">
                Démarrer Gratuitement
              </Button>
              <Button href="#demo" variant="outline" className="h-14 px-8 text-base border-gray-300">
                Voir la Démo
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Abstract 3D Composition */}
        <div className="relative h-[500px] lg:h-[700px] flex items-center justify-center perspective-1000">
           {/* CSS 3D Cubes Simulation */}
           <div className="relative w-64 h-64 md:w-96 md:h-96">
              <motion.div 
                className="absolute top-0 right-0 w-40 h-60 bg-[#E0E0E0] rounded-lg shadow-xl z-10 border border-white/50"
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div 
                className="absolute top-20 right-20 w-40 h-40 bg-[#C6F0C2] rounded-lg shadow-2xl z-20 flex items-center justify-center"
                animate={{ y: [0, 30, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <Zap className="w-16 h-16 text-black opacity-50" />
              </motion.div>
              <motion.div 
                className="absolute bottom-0 left-10 w-48 h-48 bg-[#1A1A1A] rounded-lg shadow-2xl z-30 flex items-center justify-center"
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              >
                 <div className="text-white font-bold text-xl tracking-tighter">SAKAN</div>
              </motion.div>
              
              {/* Floating elements */}
              <motion.div 
                className="absolute -top-10 left-0 w-20 h-20 bg-white rounded-full shadow-lg z-0"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 4, repeat: Infinity }}
              />
           </div>
        </div>
      </div>
    </section>
  )
}

const Pillars = () => {
  const pillars = [
    { title: "INTELLIGENCE.", desc: "La technologie que personne ne peut ignorer, mais que la plupart peinent à utiliser." },
    { title: "CONTRÔLE.", desc: "Le fossé entre la technologie, les compétences et les ressources humaines." },
    { title: "SÉRÉNITÉ.", desc: "Vraies solutions. Vrais gens. Vrais résultats pour votre copropriété." }
  ]

  return (
    <section className="bg-black text-white py-32 px-6">
      <div className="max-w-[1400px] mx-auto grid md:grid-cols-3 gap-12 lg:gap-24">
        {pillars.map((p, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.2 }}
            className="border-t border-white/20 pt-8"
          >
            <h3 className="text-4xl font-black mb-6 tracking-tight">{p.title}</h3>
            <p className="text-gray-400 text-lg leading-relaxed">{p.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

const Revolution = () => {
  return (
    <section className="bg-black text-white py-20 px-6 pb-40">
      <div className="max-w-[1400px] mx-auto">
        <motion.h2 
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="text-5xl md:text-7xl lg:text-8xl font-black uppercase leading-[0.9] max-w-5xl"
        >
          Nous Révolutionnons<br/>
          La Gestion<br/>
          Immobilière.
        </motion.h2>
        
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-16 max-w-2xl text-xl text-gray-400 space-y-6"
        >
          <p>Vous n'avez pas besoin d'IA théorique. Vous n'avez pas besoin d'applications héritées déguisées en IA.</p>
          <p>Vous avez besoin d'une "vraie" intelligence qui fonctionne maintenant — une solution qui apporte une valeur réelle à votre copropriété aujourd'hui.</p>
        </motion.div>
      </div>
    </section>
  )
}

const ProductSpotlight = () => {
  return (
    <section className="bg-black text-white py-24 px-6 border-t border-white/10">
      <div className="max-w-[1400px] mx-auto grid lg:grid-cols-2 gap-20 items-center">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-5xl md:text-6xl font-black uppercase mb-8 tracking-tight">Découvrez<br/>Sakan</h2>
            <p className="text-xl text-gray-400 mb-12 max-w-md leading-relaxed">
              Votre raccourci vers l'innovation commence ici. Sakan est plus qu'un outil de gestion — c'est un déblocage de potentiel. Augmentez la productivité avec un assistant IA personnalisé.
            </p>
            <Button href="/api/auth/signin" variant="white" className="h-14 px-8">
              Essayer Maintenant
            </Button>
          </motion.div>
        </div>
        
        <div className="relative">
           {/* Mockup Container */}
           <motion.div 
             initial={{ opacity: 0, scale: 0.9 }}
             whileInView={{ opacity: 1, scale: 1 }}
             viewport={{ once: true }}
             transition={{ duration: 0.8 }}
             className="relative rounded-xl overflow-hidden border border-white/10 bg-[#111] aspect-[16/10] shadow-2xl"
           >
             {/* Abstract UI Representation */}
             <div className="absolute top-0 left-0 right-0 h-12 border-b border-white/10 bg-[#1A1A1A] flex items-center px-4 gap-2">
               <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
               <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
               <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
             </div>
             <div className="p-8 mt-12 grid grid-cols-12 gap-6 h-full">
                <div className="col-span-3 bg-white/5 rounded-lg h-3/4"></div>
                <div className="col-span-9 grid grid-rows-2 gap-6 h-3/4">
                   <div className="grid grid-cols-3 gap-6">
                      <div className="bg-indigo-500/20 border border-indigo-500/30 rounded-lg p-4"></div>
                      <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4"></div>
                      <div className="bg-pink-500/20 border border-pink-500/30 rounded-lg p-4"></div>
                   </div>
                   <div className="bg-white/5 rounded-lg border border-white/5"></div>
                </div>
             </div>
           </motion.div>
        </div>
      </div>
    </section>
  )
}

const Supercharge = () => {
  const items = [
    { 
      icon: BarChart3, 
      title: "ANTICIPEZ", 
      desc: "Des agents qui fournissent des informations en temps réel sur les finances sans attendre les rapports."
    },
    { 
      icon: Zap, 
      title: "AUTOMATISEZ", 
      desc: "Des workflows clés en main pour automatiser les tâches répétitives et accélérer les décisions."
    },
    { 
      icon: Users, 
      title: "OPTIMISEZ", 
      desc: "Ne vous contentez pas de maintenir les lumières allumées. Assurez-vous que vos données sont prêtes pour l'IA."
    }
  ]

  return (
    <section className="bg-black text-white py-32 px-6">
      <div className="max-w-[1400px] mx-auto mb-24">
        <h2 className="text-4xl md:text-6xl font-bold max-w-3xl tracking-tight">
          Superchargez votre gestion avec l'IA Agentique
        </h2>
        <div className="mt-8">
          <Button variant="outline" className="text-white border-white/30 hover:border-white">En savoir plus</Button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto grid md:grid-cols-3 gap-16">
        {items.map((item, i) => (
          <div key={i}>
             {/* 3D Icon Placeholder */}
             <div className="mb-8 relative w-24 h-24">
                <div className="absolute inset-0 bg-white/10 rounded-lg transform rotate-3"></div>
                <div className="absolute inset-0 bg-white/5 rounded-lg transform -rotate-3"></div>
                <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1A] border border-white/10 rounded-lg">
                   <item.icon size={40} className="text-white" />
                </div>
             </div>
             <h3 className="text-2xl font-bold mb-4 uppercase tracking-wider">{item.title}</h3>
             <p className="text-gray-400 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

const UseCases = () => {
  return (
    <section className="bg-black pt-20 pb-0 relative">
      <div className="bg-white rounded-t-[3rem] md:rounded-t-[5rem] pt-32 pb-32 px-6 min-h-screen">
        <div className="max-w-[1400px] mx-auto">
           <h2 className="text-5xl md:text-7xl font-black text-black mb-12 tracking-tighter max-w-4xl">
             Explorez Notre Bibliothèque de Cas d'Usage.
           </h2>
           <p className="text-xl text-gray-500 mb-20 max-w-xl">
             Déployez l'IA rapidement. Plus de soucis sur où ou comment commencer.
           </p>

           <div className="grid md:grid-cols-2 gap-8">
              {/* Card 1 */}
              <div className="bg-[#C6F0C2] rounded-3xl p-12 relative overflow-hidden min-h-[500px] flex flex-col justify-between group transition-transform hover:scale-[1.01] duration-500">
                 <div className="z-10">
                    <h3 className="text-4xl font-black text-black mb-6 uppercase leading-tight">
                      Réduisez les délais de clôture de 20%
                    </h3>
                    <p className="text-black/80 text-lg max-w-md mb-8">
                      Accélérez le processus de clôture comptable et réalisez des économies au-delà de votre système actuel.
                    </p>
                    <Button variant="primary" className="rounded-full px-8">Plus de détails</Button>
                 </div>
                 <div className="absolute bottom-0 right-0 w-64 h-64 bg-black/5 rounded-tl-full transform translate-y-20 translate-x-20"></div>
                 
                 {/* Floating element */}
                 <div className="absolute top-1/2 right-10 transform -translate-y-1/2">
                    <div className="w-32 h-32 bg-white rounded-xl shadow-xl flex items-center justify-center rotate-12 group-hover:rotate-6 transition-transform duration-500">
                       <Wallet size={48} className="text-green-600" />
                    </div>
                 </div>
              </div>

              {/* Card 2 */}
              <div className="bg-[#F3F3F3] rounded-3xl p-12 relative overflow-hidden min-h-[500px] flex flex-col justify-between group transition-transform hover:scale-[1.01] duration-500">
                 <div className="z-10">
                    <h3 className="text-4xl font-black text-black mb-6 uppercase leading-tight">
                      Automatisez la maintenance
                    </h3>
                    <p className="text-black/70 text-lg max-w-md mb-8">
                      Gardez vos lumières allumées et laissez Sakan gérer le support avancé et les intégrations.
                    </p>
                    <Button variant="outline" className="rounded-full px-8 bg-white">Plus de détails</Button>
                 </div>
                 <div className="absolute top-1/2 right-10 transform -translate-y-1/2">
                    <div className="w-32 h-32 bg-white rounded-xl shadow-xl flex items-center justify-center -rotate-6 group-hover:rotate-0 transition-transform duration-500">
                       <Zap size={48} className="text-black" />
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </section>
  )
}

const Integrations = () => {
  return (
    <section className="bg-white py-32 px-6">
      <div className="max-w-[1400px] mx-auto">
        <h2 className="text-5xl md:text-7xl font-black text-black mb-12 tracking-tighter max-w-3xl uppercase leading-[0.9]">
          Enfin, une IA qui comprend votre immeuble.
        </h2>
        <p className="text-xl text-gray-500 mb-20 max-w-2xl">
          Nous ne nous contentons pas d'intégrer les meilleurs, nous tirons parti de décennies d'expérience pour développer des solutions natives.
        </p>

        {/* Logos Grid - Using placeholders for logos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {["Syndic", "Banque", "Assurance", "Maintenance", "Energie", "Sécurité", "Comptabilité", "Juridique"].map((name, i) => (
             <div key={i} className="h-32 bg-black text-white rounded-xl flex items-center justify-center font-bold text-xl tracking-widest uppercase hover:bg-[#1A1A1A] transition-colors cursor-default">
               {name}
             </div>
           ))}
        </div>
      </div>
    </section>
  )
}

const RunBetterBusiness = () => {
  const items = [
    { 
      id: "accounting",
      title: "Comptabilité", 
      desc: "Donnez à votre équipe les moyens de réduire la charge de travail manuelle et de gérer la clôture mensuelle.",
      bg: "bg-[#EAEAEA]"
    },
    { 
      id: "hr",
      title: "Ressources Humaines", 
      desc: "Simplifiez les RH avec le libre-service pour les employés alimenté par l'IA.",
      bg: "bg-[#F3F3F3]"
    },
    { 
      id: "procurement",
      title: "Achats", 
      desc: "Prévenez les erreurs coûteuses avant qu'elles ne surviennent. L'IA agentique analyse les données d'approvisionnement.",
      bg: "bg-[#E0E0E0]"
    }
  ]

  return (
    <section className="bg-[#F9F9F9] py-32 px-6">
      <div className="max-w-[1400px] mx-auto mb-20">
         <h2 className="text-5xl md:text-7xl font-black text-black uppercase leading-[0.9] max-w-4xl">
           Gérez un meilleur immeuble avec Sakan.
         </h2>
      </div>

      <div className="max-w-[1400px] mx-auto flex overflow-x-auto pb-12 gap-8 snap-x">
         {items.map((item, i) => (
           <div key={i} className={`min-w-[350px] md:min-w-[450px] ${item.bg} p-10 rounded-2xl flex flex-col justify-between h-[500px] snap-center`}>
              <div>
                 <div className="w-20 h-20 bg-white rounded-xl shadow-sm mb-8 flex items-center justify-center">
                    <Layers className="text-black" size={32} />
                 </div>
                 <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
                 <p className="text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
              <Button variant="white" className="w-full justify-between group">
                Plus de détails <ChevronRight className="group-hover:translate-x-1 transition-transform" size={16} />
              </Button>
           </div>
         ))}
      </div>
    </section>
  )
}

const FooterCTA = () => {
  return (
    <section className="grid md:grid-cols-2 border-t border-gray-200">
      <div className="bg-white p-12 md:p-24 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col justify-between min-h-[400px]">
         <h2 className="text-5xl md:text-6xl font-black uppercase">Réserver<br/>une Intro</h2>
         <div className="flex justify-between items-end">
           <p className="text-gray-500 max-w-xs">Transformons la façon dont le travail fonctionne.</p>
           <ArrowRight size={48} className="text-black transform -rotate-45" />
         </div>
      </div>
      <div className="bg-white p-12 md:p-24 flex flex-col justify-between min-h-[400px]">
         <h2 className="text-5xl md:text-6xl font-black uppercase">À Propos<br/>De Nous</h2>
         <div className="flex justify-between items-end">
           <p className="text-gray-500 max-w-xs">En savoir plus sur notre parcours pour redéfinir le bon travail.</p>
           <ArrowRight size={48} className="text-black transform -rotate-45" />
         </div>
      </div>
    </section>
  )
}

const Footer = () => {
  return (
    <footer className="bg-black text-white pt-32 pb-12 px-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex justify-between items-start mb-32">
           <div className="flex items-center gap-2 text-2xl font-bold">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black">
                 <Building2 size={16} />
              </div>
              {config.appName.toUpperCase()}
           </div>
           
           <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-sm text-gray-400">
              <div className="flex flex-col gap-4">
                 <strong className="text-white mb-2">Plateforme</strong>
                 <Link href="#" className="hover:text-white">Solutions</Link>
                 <Link href="#" className="hover:text-white">Experts</Link>
              </div>
              <div className="flex flex-col gap-4">
                 <strong className="text-white mb-2">Solutions</strong>
                 <Link href="#" className="hover:text-white">Syndic</Link>
                 <Link href="#" className="hover:text-white">Comptabilité</Link>
                 <Link href="#" className="hover:text-white">Maintenance</Link>
              </div>
              <div className="flex flex-col gap-4">
                 <strong className="text-white mb-2">Ressources</strong>
                 <Link href="#" className="hover:text-white">Blog</Link>
                 <Link href="#" className="hover:text-white">News</Link>
              </div>
              <div className="flex flex-col gap-4">
                 <strong className="text-white mb-2">Compagnie</strong>
                 <Link href="#" className="hover:text-white">Carrières</Link>
                 <Link href="#" className="hover:text-white">Contact</Link>
              </div>
           </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-end border-t border-white/10 pt-12 text-xs text-gray-500">
           <div className="flex flex-col gap-2">
              <p>Casablanca, Maroc</p>
              <p>Sakan © 2025 | Tous droits réservés</p>
           </div>
           <div className="flex gap-6 mt-6 md:mt-0">
              <Link href="#" className="hover:text-white">LinkedIn</Link>
              <Link href="#" className="hover:text-white">Twitter</Link>
              <Link href="#" className="hover:text-white">Confidentialité</Link>
           </div>
        </div>
      </div>
    </footer>
  )
}

export default function DayosHome({ user }: { user: any }) {
  return (
    <div className="font-sans selection:bg-black selection:text-white bg-[#F3F3F3]">
      <Navbar user={user} />
      <Hero />
      <Pillars />
      <Revolution />
      <ProductSpotlight />
      <Supercharge />
      <UseCases />
      <Integrations />
      <RunBetterBusiness />
      <FooterCTA />
      <Footer />
    </div>
  )
}

