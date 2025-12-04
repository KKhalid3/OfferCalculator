import { databaseService } from './databaseService';

/**
 * Schritt 1: Services mit Unterleistungen holen
 * 
 * LOGIK (Prioritäts-Reihenfolge):
 * 1. `includedSubServices` - Im Onboarding konfigurierte Unterleistungen (hat Vorrang)
 * 2. `includedIn` - Default-Unterleistungen aus den Stammdaten (Fallback)
 * 
 * Beispiel: 
 * - "Überholungsanstrich" hat includedSubServices: ['service_abdecken_boden', 'service_aufraeumen']
 * - Wenn im Onboarding konfiguriert, werden diese verwendet
 * - Sonst werden alle Unterleistungen verwendet, deren `includedIn` diesen Service enthält
 */
export async function getServicesWithSubServices(serviceId) {
  const service = await databaseService.getServiceById(serviceId);
  if (!service) return [];

  const allServices = [service];
  const allAvailableServices = await databaseService.getAllServices();

  let subServicesToAdd = [];

  // PRIORITÄT 1: Im Onboarding konfigurierte Unterleistungen
  if (service.includedSubServices && service.includedSubServices.length > 0) {
    console.log(`📦 Unterleistungen für "${service.title}" (aus Onboarding-Konfiguration):`);

    for (const subId of service.includedSubServices) {
      const subService = allAvailableServices.find(s => s.id === subId);
      if (subService) {
        subServicesToAdd.push(subService);
        console.log(`   ✓ ${subService.title}`);
      }
    }
  } else {
    // PRIORITÄT 2: Default-Unterleistungen aus Stammdaten (includedIn)
    subServicesToAdd = allAvailableServices.filter(s => {
      if (!s.includedIn || !Array.isArray(s.includedIn)) return false;
      if (!s.serviceType?.includes('Unterleistung Backend')) return false;
      return s.includedIn.includes(serviceId);
    });

    if (subServicesToAdd.length > 0) {
      console.log(`📦 Unterleistungen für "${service.title}" (aus Stammdaten):`);
      subServicesToAdd.forEach(s => console.log(`   - ${s.title}`));
    }
  }

  allServices.push(...subServicesToAdd);

  return allServices;
}

