export const demoAsOf=Date.UTC(2026,10,9);
const base={ChangeID:'DEMO-CHG-101',ChangeStatus:'In Progress',ChangeProjectID:'Label artwork refresh',ChangeQMS:'DEMO-QMS-101',EventQMS:'DEMO-QMS-101',EventName:'DEMO-EVT-101',Manufacturer:'ADK',Product:'Example assay A',BusinessUnit:'Diagnostics',CommercialRegion:'Europe',AppStatus:'Active',ROStatus:'In Progress',SubStatus:'In Progress',DispatchRequired:true,ChangeCreated:'2026-08-01',ChangePlannedImplementation:'2027-02-01',ChangeResponseDue:'2026-10-30'};
const filing=(country,id,overrides={})=>({...base,Country:country,ExpectedResponseCountry:country,AssessmentCountry:country,ExpectedResponseID:'DEMO-RESP-'+id,AssessmentResponseID:'DEMO-RESP-'+id,AssessmentMOHFiling:'Submission and approval required',AssessmentTimeline:'3 months',AssessmentDocumentation:'Updated dossier and local label',AppID:'DEMO-APP-'+id,ROID:'DEMO-RO-'+id,SubID:'DEMO-SUB-'+id,OriginalDispatch:'2026-10-20',LatestDispatch:'2026-11-03',OriginalSubmission:'2026-11-12',LatestSubmission:'2026-11-18',LatestApproval:'2027-01-15',...overrides});
export const demoRows=[
 filing('France','101-FR'),
 filing('Germany','101-DE',{SubStatus:'Completed',ActualDispatch:'2026-10-15',LatestApproval:'2026-12-01'}),
 filing('Spain','101-ES',{SubID:'',AssessmentResponseID:'',AssessmentCountry:'',AssessmentDocumentation:'',AssessmentMOHFiling:''}),
 filing('Italy','101-IT',{RegistrationID:'DEMO-REG-101-IT',RegistrationState:'Approved',RegistrationCountry:'Italy',RegistrationStart:'2026-11-01',RegistrationEnd:'9999-12-31',RegistrationNumber:'EXAMPLE-101',Product:'Example assay A',CatalogNumber:'DEMO-CAT-01'}),
 filing('Italy','101-IT',{RegistrationID:'DEMO-REG-101-IT',RegistrationState:'Approved',RegistrationCountry:'Italy',RegistrationStart:'2026-11-01',RegistrationEnd:'9999-12-31',RegistrationNumber:'EXAMPLE-101',Product:'Example assay A',CatalogNumber:'DEMO-CAT-02'}),
 filing('Ireland','102-IE',{ChangeID:'DEMO-CHG-102',ChangeProjectID:'Manufacturing transfer',Manufacturer:'ADJ',Product:'Example test B',DispatchRequired:false,LatestSubmission:'2026-11-04'}),
 filing('Portugal','103-PT',{ChangeID:'DEMO-CHG-103',ChangeProjectID:'Method update',ActualDispatch:'2026-10-20',LatestSubmission:'2026-11-05'}),
 filing('Sweden','104-SE',{ChangeID:'DEMO-CHG-104',ChangeProjectID:'Packaging update',SubStatus:'Planned',LatestDispatch:'2026-11-20'}),
 filing('Belgium','105-BE',{ChangeID:'DEMO-CHG-105',ChangeProjectID:'Missing dispatch target',OriginalDispatch:'',LatestDispatch:'',Manufacturer:'ABO'}),
 filing('Denmark','106-DK',{ChangeID:'DEMO-CHG-106',ChangeProjectID:'Approved source change',ChangeStatus:'Completed',ROStatus:'Health Authority Approved',Manufacturer:'SCR'}),
 filing('Finland','107-FI',{ChangeID:'DEMO-CHG-107',ChangeProjectID:'Withdrawn filing',SubStatus:'Withdrawn',Manufacturer:'AJG'}),
 filing('Norway','108-NO',{ChangeID:'DEMO-CHG-108',ChangeProjectID:'Authority rejection',SubStatus:'Rejected',Manufacturer:'ARDG'}),
 filing('Poland','unlinked',{ChangeID:'',ChangeProjectID:'',Manufacturer:'ADK'}),
 {AppID:'DEMO-APP-NO-EVENT',AppStatus:'Active',Country:'Czechia',Product:'Example assay A',Manufacturer:'ADK',BusinessUnit:'Diagnostics'}
];
for(const row of demoRows)if(row.SubID||row.ChangeID){row.EventName=row.ChangeID?'DEMO-EVT-'+row.ChangeID.slice(-3):'DEMO-EVT-NO-CHANGE';row.EventState=row.ChangeStatus==='Completed'?'Closed State':'In Progress State';}
export function largeRows(count=10000){return Array.from({length:count},(_,i)=>filing('France',String(i),{ChangeID:'LOAD-'+Math.floor(i/4),EventName:'LOAD-EVT-'+Math.floor(i/4),EventState:'In Progress State',ChangeQMS:'LOAD-QMS-'+Math.floor(i/4),EventQMS:'LOAD-QMS-'+Math.floor(i/4),ChangeProjectID:'Load test',Product:'Synthetic product '+i%20,Manufacturer:['ABO','ADJ','ADK','AJG','ARDG','SCR'][i%6]}));}
