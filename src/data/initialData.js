// Initial-Daten - Importiert aus servicesData.js
import { servicesData, specialServicesData } from './servicesData';

export const initialData = {
  services: servicesData,
  specialServices: specialServicesData,

  factors: [
    {
      id: 'factor_flur',
      name: 'Flur',
      factor: 1.2,
      affectsArea: ['Umfang'],
      affectsService: [],
      category: 'Mengen',
      objectType: 'Raum',
      inputType: 'Objektverwaltung',
      source: 'Admin SE'
    },
    {
      id: 'factor_l',
      name: 'L',
      factor: 1.4,
      affectsArea: ['Umfang'],
      affectsService: [],
      category: 'Mengen',
      objectType: 'Raum',
      inputType: 'Objektverwaltung',
      source: 'Admin SE'
    },
    {
      id: 'factor_bad',
      name: 'Bad',
      factor: 2.0,
      affectsArea: ['Decken', 'Wände'],
      affectsService: [
        'service_tapete_entfernen',
        'service_raufaser',
        'service_malervlies',
        'service_mustertapete',
        'service_overholungsanstrich',
        'service_neuanstrich_frisch',
        'service_neuanstrich_raufaser',
        'service_neuanstrich_malervlies'
      ],
      category: 'Leistung',
      objectType: 'Raum',
      inputType: 'Objektverwaltung',
      source: 'Admin SE'
    },
    {
      id: 'factor_treppenhaus',
      name: 'Treppenhaus',
      factor: 1.3,
      affectsArea: ['Decken', 'Wände'],
      affectsService: [
        'service_tapete_entfernen',
        'service_raufaser',
        'service_malervlies',
        'service_mustertapete',
        'service_overholungsanstrich',
        'service_neuanstrich_frisch',
        'service_neuanstrich_raufaser',
        'service_neuanstrich_malervlies'
      ],
      category: 'Leistung',
      objectType: 'Raum',
      inputType: 'Objektverwaltung',
      source: 'Admin SE'
    },
    {
      id: 'factor_kueche',
      name: 'Küche',
      factor: 1.25,
      affectsArea: ['Decken', 'Wände'],
      affectsService: [
        'service_tapete_entfernen',
        'service_raufaser',
        'service_malervlies',
        'service_mustertapete',
        'service_overholungsanstrich',
        'service_neuanstrich_frisch',
        'service_neuanstrich_raufaser',
        'service_neuanstrich_malervlies'
      ],
      category: 'Leistung',
      objectType: 'Raum',
      inputType: 'Objektverwaltung',
      source: 'Admin SE'
    }
  ]
};

