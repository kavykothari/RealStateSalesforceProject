public with sharing class AarvyaEstates_CostSheetPDFController {

    
public class PaymentMilestoneRow {
    public Integer serialNumber { get; set; }
    public String milestoneName { get; set; }
    public String percentageLabel { get; set; }
    public Decimal paymentAmount { get; set; }
    public Decimal gstAmount { get; set; }
    public Decimal totalAmount { get; set; }
    public Boolean showGST { get; set; }

    public PaymentMilestoneRow(
        Integer serialNumber,
        String milestoneName,
        String percentageLabel,
        Decimal paymentAmount,
        Decimal gstAmount,
        Decimal totalAmount,
        Boolean showGST
    ) {
        this.serialNumber = serialNumber;
        this.milestoneName = milestoneName;
        this.percentageLabel = percentageLabel;
        this.paymentAmount = paymentAmount;
        this.gstAmount = gstAmount;
        this.totalAmount = totalAmount;
        this.showGST = showGST;
    }
}

public Decimal paymentScheduleTotal { get; private set; }
public Decimal paymentScheduleGSTTotal { get; private set; }
public Decimal paymentScheduleGrandTotal { get; private set; }


public List<PaymentMilestoneRow> getPaymentMilestones() {
    Decimal finalPayable = discountedTotal == null
        ? 0 : discountedTotal;

    Decimal gstTotal = unitRecord.GST_Amount__c == null
        ? 0 : unitRecord.GST_Amount__c;

    Decimal stampDuty = unitRecord.Stamp_Duty_Amount__c == null
        ? 0 : unitRecord.Stamp_Duty_Amount__c;

    Decimal registration = unitRecord.Registration_Charges__c == null
        ? 0 : unitRecord.Registration_Charges__c;

    Decimal tokenAmount = 99000;
    Decimal lawyerFees = 14000;

    Decimal governmentTaxes = stampDuty + registration;

    // Derive the installment base from the FINAL PAYABLE amount.
    // GST, government taxes and lawyer fees are already included
    // in the Final Payable Amount, so exclude them before calculating
    // the percentage-based installments.
    Decimal baseAmount = finalPayable
        - gstTotal
        - governmentTaxes
        - lawyerFees;

    List<String> labels = new List<String>{
        'Token Amount',
        'Immediate Application Money (Within 7 days)',
        'Government Taxes',
        'At the time of the registration of the document',
        'Completion of plinth / Basement slab',
        'Completion of 1st floor slab',
        'Completion of 5th floor slab',
        'Completion of 9th floor slab',
        'Completion of 13th floor slab',
        'Completion of 17th floor slab',
        'Completion of 21st floor slab',
        'Completion of 25th floor slab',
        'Completion of 28th floor slab',
        'Completion of Terrace slab',
        'Completion of the walls, Internal plastering',
        'Completion of the flooring, terraces and waterproofing',
        'Completion of the staircase, lift wells, lobbies',
        'Completion of the external plumbing, electric points, entrance lobbies and plinth protection',
        'Completion of sanitary, C.P. fittings, water pumps, external plaster, paving',
        'Completion of possession',
        'Lawyer/Scanning fees'
    };

    List<Decimal> percentages = new List<Decimal>{
        0, 10, 0, 20, 15, 4, 4, 4, 3, 2, 2, 2, 2, 2, 5, 5, 5, 5, 5, 5, 0
    };

    List<PaymentMilestoneRow> rows =
        new List<PaymentMilestoneRow>();

    paymentScheduleTotal = 0;
    paymentScheduleGSTTotal = 0;
    paymentScheduleGrandTotal = 0;

    for (Integer i = 0; i < labels.size(); i++) {
        Decimal amount = 0;
        Decimal gst = 0;
        String pctLabel = '-';
        Boolean showGST = true;

        if (i == 0) {
            // Token is part of the 10% application installment.
            amount = tokenAmount;
            showGST = false;
        } else if (i == 1) {
            amount = (baseAmount * 0.10).setScale(2)
                - tokenAmount;
            pctLabel = '10.0%';

            // Allocate existing GST proportionally.
            gst = (gstTotal * 0.10).setScale(2);
        } else if (i == 2) {
            amount = governmentTaxes;
            pctLabel = 'Stamp Duty + Reg';
            showGST = false;
        } else if (i == 20) {
            amount = lawyerFees;
            showGST = false;
        } else {
            Decimal pct = percentages[i];

            amount = (baseAmount * pct / 100).setScale(2);
            pctLabel = String.valueOf(pct.setScale(1)) + '%';

            // Allocate the existing GST; do not calculate GST again.
            gst = (gstTotal * pct / 100).setScale(2);
        }

        Decimal total = amount + gst;

        rows.add(new PaymentMilestoneRow(
            i + 1,
            labels[i],
            pctLabel,
            amount,
            gst,
            total,
            showGST
        ));

        paymentScheduleTotal += amount;
        paymentScheduleGSTTotal += gst;
        paymentScheduleGrandTotal += total;
    }

    return rows;
}



    public Unit__c unitRecord { get; private set; }
    public String couponCode { get; private set; }
    public Decimal discountAmount { get; private set; }
    public Decimal discountedTotal { get; private set; }
    public Boolean hasDiscount { get; private set; }

    public Opportunity opportunityRecord { get; private set; }
    public Contact customerContact { get; private set; }

    public AarvyaEstates_CostSheetPDFController() {

        String unitId =
            ApexPages.currentPage()
                .getParameters()
                .get('unitId');

        String opportunityId =
            ApexPages.currentPage()
                .getParameters()
                .get('opportunityId');


        if (String.isBlank(unitId)) {
            return;
        }


        unitRecord = [
            SELECT Id,
                   Name,
                   Unit_Flat_Code__c,
                   Configuration__c,
                   Facing__c,
                   Flat_Facing_View__c,
                   Super_Built_up_Area_Sq_Ft__c,
                   Rate_per_Sq_Ft__c,
                   Total_Amount__c,
                   Flat_Facing_Charges__c,
                   Parking_Charges__c,
                   Floor_Rise_Charges__c,
                   Amenities_Charges__c,
                   GST__c,
                   GST_Amount__c,
                   Stamp_Duty__c,
                   Stamp_Duty_Amount__c,
                   Registration_Charges__c,
                   Lawyer_Scanning_Fees__c,
                   Total_Amount_All_Inclusive__c,
                   Project__c,
                   Project__r.Name,
                   Tower__c,
                   Tower__r.Name,
                   Floor__c,
                   Floor__r.Name,
                   Purchased_By__c,
                   Purchased_By__r.Name,
                   Sold_By__c,
                   Sold_By__r.Name
            FROM Unit__c
            WHERE Id = :unitId
            WITH USER_MODE
            LIMIT 1
        ];


        if (!String.isBlank(opportunityId)) {

            opportunityRecord = [
                SELECT Id,
                       Name,
                       StageName,
                       AccountId,
                       ContactId,
                       Account.Name
                FROM Opportunity
                WHERE Id = :opportunityId
                WITH USER_MODE
                LIMIT 1
            ];
        }
         if (opportunityRecord.ContactId != null) {
                customerContact = [
                    SELECT Id, Name, Email, Phone
                    FROM Contact
                    WHERE Id = :opportunityRecord.ContactId
                    WITH USER_MODE
                    LIMIT 1
                ];
            }
        calculateCouponDiscount();
    }

    private void calculateCouponDiscount() {
            couponCode = ApexPages.currentPage()
                .getParameters()
                .get('couponCode');

            discountAmount = 0;
            hasDiscount = false;

            discountedTotal =
                unitRecord.Total_Amount_All_Inclusive__c == null
                ? 0
                : unitRecord.Total_Amount_All_Inclusive__c;

            if (
                String.isBlank(couponCode) ||
                unitRecord.Project__c == null
            ) {
                return;
            }

            List<Discount_Policy__c> policies = [
                SELECT Discount_Code__c,
                    Active__c,
                    Discount_Value__c,
                    Applicable_Project__c
                FROM Discount_Policy__c
                WHERE Discount_Code__c = :couponCode.trim()
                AND Active__c = true
                AND Applicable_Project__c = :unitRecord.Project__c
                LIMIT 1
            ];

            if (policies.isEmpty()) {
                return;
            }

            Discount_Policy__c policy = policies[0];

            if (
                policy.Discount_Value__c == null ||
                policy.Discount_Value__c <= 0
            ) {
                return;
            }

            discountAmount = Math.min(
                policy.Discount_Value__c,
                discountedTotal
            );

            discountedTotal -= discountAmount;
            hasDiscount = discountAmount > 0;
        }


    public String getGeneratedDate() {

        return DateTime.now()
            .format('dd MMM yyyy, hh:mm a');
    }


    public String getUnitNumber() {

        if (unitRecord == null) {
            return '';
        }

        if (!String.isBlank(unitRecord.Unit_Flat_Code__c)) {
            return unitRecord.Unit_Flat_Code__c;
        }

        return unitRecord.Name;
    }
}