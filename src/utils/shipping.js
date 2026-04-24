// Mirror of EcommerceAPI/utils/shipping.js — used only to preview the rate on checkout.
// The backend always recomputes the fee from province; never trust this value for pricing.

export const SHIPPING_REGIONS = {
    NCR:      { label: 'Metro Manila (NCR)',  rate: 180 },
    LUZON:    { label: 'Luzon (outside NCR)', rate: 250 },
    VISAYAS:  { label: 'Visayas',             rate: 400 },
    MINDANAO: { label: 'Mindanao',            rate: 500 },
};

export const PROVINCE_GROUPS = [
    {
        region: 'NCR',
        provinces: ['Metro Manila'],
    },
    {
        region: 'LUZON',
        provinces: [
            'Abra','Apayao','Benguet','Ifugao','Kalinga','Mountain Province',
            'Ilocos Norte','Ilocos Sur','La Union','Pangasinan',
            'Batanes','Cagayan','Isabela','Nueva Vizcaya','Quirino',
            'Aurora','Bataan','Bulacan','Nueva Ecija','Pampanga','Tarlac','Zambales',
            'Batangas','Cavite','Laguna','Quezon','Rizal',
            'Marinduque','Occidental Mindoro','Oriental Mindoro','Palawan','Romblon',
            'Albay','Camarines Norte','Camarines Sur','Catanduanes','Masbate','Sorsogon',
        ],
    },
    {
        region: 'VISAYAS',
        provinces: [
            'Aklan','Antique','Capiz','Guimaras','Iloilo','Negros Occidental',
            'Bohol','Cebu','Negros Oriental','Siquijor',
            'Biliran','Eastern Samar','Leyte','Northern Samar','Samar','Southern Leyte',
        ],
    },
    {
        region: 'MINDANAO',
        provinces: [
            'Zamboanga del Norte','Zamboanga del Sur','Zamboanga Sibugay',
            'Bukidnon','Camiguin','Lanao del Norte','Misamis Occidental','Misamis Oriental',
            'Davao de Oro','Davao del Norte','Davao del Sur','Davao Occidental','Davao Oriental',
            'Cotabato','Sarangani','South Cotabato','Sultan Kudarat',
            'Agusan del Norte','Agusan del Sur','Dinagat Islands','Surigao del Norte','Surigao del Sur',
            'Basilan','Lanao del Sur','Maguindanao del Norte','Maguindanao del Sur','Sulu','Tawi-Tawi',
        ],
    },
];

const PROVINCE_TO_REGION = Object.fromEntries(
    PROVINCE_GROUPS.flatMap(g => g.provinces.map(p => [p, g.region]))
);

export function computeShippingFromProvince(province) {
    const region = PROVINCE_TO_REGION[province];
    if (!region) return null;
    const def = SHIPPING_REGIONS[region];
    return { fee: def.rate, regionCode: region, regionLabel: def.label };
}
