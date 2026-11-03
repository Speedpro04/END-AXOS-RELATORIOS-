import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Site } from '../types/os'
import { db } from '../services/dbDexie'

interface ObraContextType {
  obraAtual: Site | null
  obras: Site[]
  carregarObras: () => Promise<void>
  selecionarObra: (obra: Site | null) => void
}

const ObraContext = createContext<ObraContextType | undefined>(undefined)

export const ObraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [obraAtual, setObraAtualState] = useState<Site | null>(null)
  const [obras, setObras] = useState<Site[]>([])

  const carregarObras = async () => {
    const todas = await db.sites.toArray()
    setObras(todas)
  }

  useEffect(() => {
    const saved = localStorage.getItem('axos_obra_atual')
    if (saved) {
      try {
        setObraAtualState(JSON.parse(saved))
      } catch {}
    }
    carregarObras()
  }, [])

  const selecionarObra = (obra: Site | null) => {
    setObraAtualState(obra)
    if (obra) {
      localStorage.setItem('axos_obra_atual', JSON.stringify(obra))
    } else {
      localStorage.removeItem('axos_obra_atual')
    }
  }

  return (
    <ObraContext.Provider value={{ obraAtual, obras, carregarObras, selecionarObra }}>
      {children}
    </ObraContext.Provider>
  )
}

export const useObra = () => {
  const ctx = useContext(ObraContext)
  if (!ctx) throw new Error('useObra deve ser usado dentro de ObraProvider')
  return ctx
}
