public with sharing class AarvyaEstates_TowerInventoryController {
    public class UnitRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String unitNumber;
        @AuraEnabled public String unitCode;
        @AuraEnabled public String configuration;
        @AuraEnabled public String constructionStatus;
        @AuraEnabled public String facing;
        @AuraEnabled public String view;
        @AuraEnabled public String flatStatus;
        @AuraEnabled public String possessionStatus;
        @AuraEnabled public Integer position;
        @AuraEnabled public Id purchasedById;
@AuraEnabled public Id bookedById;
@AuraEnabled public Id reservedOnHoldById;

@AuraEnabled public Decimal ratePerSqFt;
@AuraEnabled public Decimal flatFacingCharges;
@AuraEnabled public Decimal parkingCharges;
@AuraEnabled public Decimal floorRiseCharges;
@AuraEnabled public Decimal amenitiesCharges;
@AuraEnabled public Decimal superBuiltUpArea;
@AuraEnabled public Decimal totalAmount;
@AuraEnabled public Decimal gst;
    }

    public class FloorRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String floorNumber;
        @AuraEnabled public String floorCode;
        @AuraEnabled public String status;
        @AuraEnabled public Integer sortOrder;
        @AuraEnabled public List<UnitRow> units = new List<UnitRow>();
    }

    public class TowerInventory {
        @AuraEnabled public Id towerId;
        @AuraEnabled public String towerName;
        @AuraEnabled public Integer totalFloors;
        @AuraEnabled public Integer totalUnits;
        @AuraEnabled public Integer availableCount;
        @AuraEnabled public Integer onHoldCount;
        @AuraEnabled public Integer bookedCount;
        @AuraEnabled public Integer maxUnitsPerFloor;
        @AuraEnabled public List<FloorRow> floors = new List<FloorRow>();
    }

    @AuraEnabled(cacheable=true)
    public static TowerInventory getTowerInventory(Id towerId) {
        if (towerId == null) {
            throw new AuraHandledException('Tower Id is required.');
        }

        Tower__c tower = [
            SELECT Id, Name
            FROM Tower__c
            WHERE Id = :towerId
            WITH USER_MODE
            LIMIT 1
        ];

        List<Floor__c> floorRecords = [
            SELECT Id, Name, Floor_Code__c, Status__c
            FROM Floor__c
            WHERE Tower__c = :towerId
            WITH USER_MODE
            ORDER BY CreatedDate ASC
        ];

        List<Unit__c> unitRecords = [
    SELECT Id,
           Name,
           Unit_Flat_Code__c,
           Configuration__c,
           Construction_Status__c,
           Facing__c,
           Flat_Facing_View__c,
           Flat_Status__c,
           Possession_Status__c,
           Floor__c,
           Purchased_By__c,
           Sold_By__c,
           Rate_per_Sq_Ft__c,
           Flat_Facing_Charges__c,
           Parking_Charges__c,
           Floor_Rise_Charges__c,
           Amenities_Charges__c,
           Super_Built_up_Area_Sq_Ft__c,
           Total_Amount__c,
           GST__c
    FROM Unit__c
    WHERE Tower__c = :towerId
      AND Flat_Status__c IN (
          'Available',
          'Reserved (On Hold)',
          'Booked'
      )
    WITH USER_MODE
    ORDER BY CreatedDate ASC
];

        Map<Id, FloorRow> floorById = new Map<Id, FloorRow>();
        for (Floor__c floorRecord : floorRecords) {
            FloorRow row = new FloorRow();
            row.id = floorRecord.Id;
            row.floorNumber = floorRecord.Name;
            row.floorCode = floorRecord.Floor_Code__c;
            row.status = floorRecord.Status__c;
            row.sortOrder = naturalNumber(floorRecord.Name);
            floorById.put(floorRecord.Id, row);
        }

        for (Unit__c unitRecord : unitRecords) {
            if (unitRecord.Floor__c == null || !floorById.containsKey(unitRecord.Floor__c)) {
                continue;
            }

            UnitRow row = new UnitRow();
            row.id = unitRecord.Id;
            //row.unitNumber = String.isBlank(unitRecord.Unit_Flat_Code__c) ? unitRecord.Name : unitRecord.Unit_Flat_Code__c;
            row.unitNumber = String.isNotBlank(unitRecord.Name) ? unitRecord.Name : unitRecord.Unit_Flat_Code__c;
            row.unitCode = unitRecord.Unit_Flat_Code__c;
            row.configuration = unitRecord.Configuration__c;
            row.constructionStatus = unitRecord.Construction_Status__c;
            row.facing = unitRecord.Facing__c;
            row.view = unitRecord.Flat_Facing_View__c;
            row.flatStatus = unitRecord.Flat_Status__c;
            row.possessionStatus = unitRecord.Possession_Status__c;
            row.position = naturalNumber(row.unitNumber);
            row.purchasedById = unitRecord.Purchased_By__c;
row.bookedById = unitRecord.Sold_By__c;
row.reservedOnHoldById = unitRecord.Sold_By__c;

row.ratePerSqFt = unitRecord.Rate_per_Sq_Ft__c;
row.flatFacingCharges = unitRecord.Flat_Facing_Charges__c;
row.parkingCharges = unitRecord.Parking_Charges__c;
row.floorRiseCharges = unitRecord.Floor_Rise_Charges__c;
row.amenitiesCharges = unitRecord.Amenities_Charges__c;
row.superBuiltUpArea = unitRecord.Super_Built_up_Area_Sq_Ft__c;
row.totalAmount = unitRecord.Total_Amount__c;
row.gst = unitRecord.GST__c;
            floorById.get(unitRecord.Floor__c).units.add(row);
        }

        List<FloorRow> floors = new List<FloorRow>();
        for (FloorRow floor : floorById.values()) {
            floor.units.sort(new UnitRowComparator());
            floors.add(floor);
        }
        floors.sort(new FloorRowComparator());

        TowerInventory result = new TowerInventory();
        result.availableCount = 0;
        result.onHoldCount = 0;
        result.bookedCount = 0;
        result.towerId = tower.Id;
        result.towerName = tower.Name;
        result.totalFloors = floors.size();
        result.totalUnits = unitRecords.size();
        result.floors = floors;
        result.maxUnitsPerFloor = 0;

        for (Unit__c unitRecord : unitRecords) {
            if (unitRecord.Flat_Status__c == 'Available') {
                result.availableCount++;
            } else if (unitRecord.Flat_Status__c == 'Reserved (On Hold)') {
                result.onHoldCount++;
            } else if (unitRecord.Flat_Status__c == 'Booked') {
                result.bookedCount++;
            }
        }
        if (result.availableCount == null) result.availableCount = 0;
        if (result.onHoldCount == null) result.onHoldCount = 0;
        if (result.bookedCount == null) result.bookedCount = 0;

        for (FloorRow floor : floors) {
            if (floor.units.size() > result.maxUnitsPerFloor) {
                result.maxUnitsPerFloor = floor.units.size();
            }
        }

        return result;
    }

    private static Integer naturalNumber(String value) {
        if (String.isBlank(value)) return 999999;
        String digits = value.replaceAll('[^0-9]', '');
        if (String.isBlank(digits)) return 999999;
        try {
            return Integer.valueOf(digits);
        } catch (Exception e) {
            return 999999;
        }
    }

    public class FloorRowComparator implements Comparator<FloorRow> {
        public Integer compare(FloorRow a, FloorRow b) {
            if (a.sortOrder == b.sortOrder) return 0;
            return a.sortOrder < b.sortOrder ? -1 : 1;
        }
    }

    public class UnitRowComparator implements Comparator<UnitRow> {
        public Integer compare(UnitRow a, UnitRow b) {
            if (a.position == b.position) return 0;
            return a.position < b.position ? -1 : 1;
        }
    }
    @AuraEnabled
public static void bookUnit(
    Id unitId,
    Id purchasedById,
    Id bookedById,
    Id reservedOnHoldById
) {
    if (unitId == null) {
        throw new AuraHandledException('Unit Id is required.');
    }

    /*
     * Lock the record so two users cannot book
     * the same unit at the same time.
     */
    Unit__c unitRecord = [
        SELECT Id,
               Flat_Status__c,
               Purchased_By__c,
               Sold_By__c
               
        FROM Unit__c
        WHERE Id = :unitId
        FOR UPDATE
    ];

    /*
     * Backend status check
     */
    if (unitRecord.Flat_Status__c != 'Available') {

        if (unitRecord.Flat_Status__c == 'Booked') {
            throw new AuraHandledException(
                'This unit has already been booked.'
            );
        }

        if (unitRecord.Flat_Status__c == 'Reserved (On Hold)') {
            throw new AuraHandledException(
                'This unit is currently reserved (on hold).'
            );
        }

        throw new AuraHandledException(
            'This unit is no longer available.'
        );
    }

    /*
     * Save contact details
     */
    unitRecord.Purchased_By__c = purchasedById;
    unitRecord.Sold_By__c = bookedById;
    unitRecord.Token_Amount_Received__c = True;

    /*
     * Change status
     */
     unitRecord.Flat_Status__c = purchasedById != null  ? 'Booked' : 'Reserved (On Hold)';
    
    
    Opportunity opp = [
        SELECT Id, Name, StageName
        FROM Opportunity
        WHERE ContactId = :purchasedById
        LIMIT 1
    ];
    unitRecord.Opportunity__c = opp.Id;

    opp.StageName = 'Token Amount Received';

    update as user unitRecord;
    update opp;

}
}