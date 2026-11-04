export function demoRows(asOf=new Date()){
 const today=Date.UTC(asOf.getUTCFullYear(),asOf.getUTCMonth(),asOf.getUTCDate()),day=n=>new Date(today+n*86400000).toISOString().slice(0,10);
 const countries=['Ireland','United Kingdom','France','Germany','Spain','Italy','Poland','Sweden','Norway','Romania','Greece','Portugal','Netherlands','United States','Canada','Mexico','Brazil','Argentina','Chile','Colombia','South Africa','Kenya','Nigeria','Egypt','Morocco','Saudi Arabia','United Arab Emirates','India','China','Japan','South Korea','Thailand','Vietnam','Singapore','Malaysia','Indonesia','Australia','New Zealand','Malta','Bahrain','Philippines','Peru'];
 const sites=['ABO','ADJ','ADK','AJG','ARDG','SCR'],products=['Assay Alpha','Diagnostic Beta','Device Gamma','Test Delta'],states=['Approved','Approved','Conditionally Approved','Approved','Planned','Expired','Approved','Withdrawn'];
 const rows=[];let i=0;for(let market=0;market<countries.length;market++)for(let n=0;n<1+(market%9);n++,i++){
  const row={RegistrationID:'REG-DEMO-'+String(i+1).padStart(4,'0'),RegistrationNumber:'DEMO-'+(10000+i),RegistrationCountry:countries[market],RegistrationState:states[i%states.length],RegistrationStart:day(-730-i),RegistrationEnd:i%17===0?'9000-12-31':day(i%8===0?-30:i%5===0?45:420+i),Product:products[i%4],ProductID:'PROD-'+(i%4+1),Manufacturer:sites[i%6],RegistrationManufacturingSite:sites[(i+2)%6],BusinessUnit:['ID','CMI','Core Lab'][i%3],Country:countries[market],AppID:'APP-DEMO-'+Math.floor(i/3),ROID:'RO-DEMO-'+i,SubID:'SUB-DEMO-'+i,CatalogNumber:'CAT-'+String(i).padStart(4,'0'),RegistrationHolder:'Example registration holder',RegistrationURL:'https://example.com/registration/'+(i+1)};
  rows.push(row);if(i%3===0)rows.push({...row,CatalogNumber:'CAT-'+String(i).padStart(4,'0')+'-B'});
 }
 rows.push({...rows[0],RegistrationID:'REG-DEMO-REVIEW',RegistrationCountry:'Unrecognized market',Country:'Ireland'});
 rows.push({...rows[1],RegistrationID:'REG-DEMO-CONFLICT',RegistrationState:'Approved'}, {...rows[1],RegistrationID:'REG-DEMO-CONFLICT',RegistrationState:'Withdrawn'});
 rows.push({...rows[2],RegistrationID:'',RegistrationCountry:'Singapore',AppID:'APP-DEMO-MISSING-ID'});
 rows.push({...rows[3],RegistrationID:'REG-DEMO-FALLBACK',RegistrationCountry:'',Country:'Malta'});
 return rows;
}
