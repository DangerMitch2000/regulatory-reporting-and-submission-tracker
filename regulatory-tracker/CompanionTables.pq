// Create a blank Power Query named BuildTimelineCompanion and paste this function.
// Input must contain generic aliases. Native Date columns are preferred; text is parsed en-IE.
(Input as table) as record =>
let
    TextValue = (value as any) as nullable text => if value = null then null else let t = Text.Trim(Text.From(value)) in if t = "" then null else t,
    KeyPart = (value as any) as text => let t = TextValue(value) in if t = null then "0:" else Text.From(Text.Length(t)) & ":" & t,
    DateFields = {"OriginalDispatch", "LatestDispatch", "ActualDispatch", "OriginalSubmission", "LatestSubmission", "ActualSubmission", "OriginalApproval", "LatestApproval", "ActualApproval", "RegistrationStart", "RegistrationEnd", "SubCreated"},
    Required = {"AppID", "ROID", "SubID", "AppStatus", "ROStatus", "SubStatus", "SubmissionType", "Manufacturer", "Product", "Country"} & DateFields,
    WithColumns = List.Accumulate(Required, Input, (t, c) => if Table.HasColumns(t, c) then t else Table.AddColumn(t, c, each null)),
    ValidIDs = Table.SelectRows(WithColumns, each TextValue([AppID]) <> null and TextValue([ROID]) <> null and TextValue([SubID]) <> null),
    NormalizedIDs = Table.TransformColumns(ValidIDs, {{"AppID",TextValue,type text},{"ROID",TextValue,type text},{"SubID",TextValue,type text}}),
    Keyed = Table.AddColumn(NormalizedIDs, "SubmissionKey", each KeyPart([AppID]) & "|" & KeyPart([ROID]) & "|" & KeyPart([SubID]), type text),
    ResolveText = (t as table, col as text) as text => let vals = List.Distinct(List.Transform(Table.Column(t,col), each if TextValue(_) = null then "Not recorded" else TextValue(_))) in if List.Count(vals)=1 then vals{0} else "Conflicting values",
    Members = (t as table, col as text) as list => List.Sort(List.Distinct(List.Transform(Table.Column(t,col),each if TextValue(_)=null then "(missing)" else TextValue(_)))),
    ResolveDate = (t as table, col as text) as record =>
        let values = Table.Column(t,col), populated = List.Select(values,each TextValue(_)<>null),
            parsed = List.Transform(populated,each try (if Value.Is(_,type number) then error "Use a native Date column" else Date.From(_,"en-IE"))),
            bad = List.AnyTrue(List.Transform(parsed,each [HasError])),
            dates = List.Distinct(List.Transform(List.Select(parsed,each not [HasError]),each [Value])),
            count = List.Count(dates), value = if bad or count<>1 then null else dates{0},
            issue = if bad then "Invalid input; withheld" else if count>1 then "Conflicting dates; withheld" else if count=0 then "Not recorded" else if List.Count(populated)<List.Count(values) then "Some membership rows blank" else ""
        in [Value=value,Issue=issue],
    Resolve = (t as table) as record =>
        let row = t{0}, dateRecords = Record.FromList(List.Transform(DateFields,each ResolveDate(t,_)),DateFields),
            d = (name as text) as nullable date => Record.Field(dateRecords,name)[Value],
            days = (a as nullable date,b as nullable date) as nullable number => if a=null or b=null or b<a then null else Duration.Days(b-a),
            variance = (actual as nullable date,plan as nullable date) as nullable number => if actual=null or plan=null then null else Duration.Days(actual-plan),
            products = Members(t,"Product"), countries=Members(t,"Country"), sites=Members(t,"Manufacturer"),
            ownState=ResolveText(t,"SubStatus"), kind=ResolveText(t,"SubmissionType"),
            summary = [SubmissionKey=row[SubmissionKey],AppID=row[AppID],ROID=row[ROID],SubID=row[SubID],SubStatus=ownState,SubmissionType=kind,
                Products=Text.Combine(products,"; "),Countries=Text.Combine(countries,"; "),LegalManufacturers=Text.Combine(sites,"; "),
                SearchText=Text.Combine({row[AppID],row[ROID],row[SubID],kind,Text.Combine(products," "),Text.Combine(countries," ")}," | "),
                DispatchDays=days(d("ActualDispatch"),d("ActualSubmission")),ApprovalDays=days(d("ActualSubmission"),d("ActualApproval")),
                ApprovalOriginalVariance=variance(d("ActualApproval"),d("OriginalApproval")),ApprovalLatestVariance=variance(d("ActualApproval"),d("LatestApproval")),
                RegistrationStart=d("RegistrationStart"),RegistrationEnd=d("RegistrationEnd")],
            milestones=List.Transform({"Dispatch","Submission","Approval"},(stage)=>[SubmissionKey=row[SubmissionKey],Milestone=stage,Original=d("Original"&stage),Latest=d("Latest"&stage),Actual=d("Actual"&stage)]),
            memberships=List.Combine(List.Transform({[Kind="Product",Items=products],[Kind="Country",Items=countries],[Kind="Legal manufacturer",Items=sites]},(group)=>List.Transform(group[Items],(item)=>[SubmissionKey=row[SubmissionKey],Kind=group[Kind],Value=item]))),
            issues=List.Transform(List.Select(DateFields,each Record.Field(dateRecords,_)[Issue]<>""),(field)=>[SubmissionKey=row[SubmissionKey],Field=field,Issue=Record.Field(dateRecords,field)[Issue]])
        in [Summary=summary,Dates=milestones,Members=memberships,Issues=issues],
    Groups=Table.Group(Keyed,{"SubmissionKey"},{{"Resolved",each Resolve(_)}}),
    Records=Groups[Resolved],
    Summaries=Table.FromRecords(List.Transform(Records,each [Summary]),{"SubmissionKey","AppID","ROID","SubID","SubStatus","SubmissionType","Products","Countries","LegalManufacturers","SearchText","DispatchDays","ApprovalDays","ApprovalOriginalVariance","ApprovalLatestVariance","RegistrationStart","RegistrationEnd"},MissingField.UseNull),
    Dates=Table.FromRecords(List.Combine(List.Transform(Records,each [Dates])),{"SubmissionKey","Milestone","Original","Latest","Actual"},MissingField.UseNull),
    Memberships=Table.FromRecords(List.Combine(List.Transform(Records,each [Members])),{"SubmissionKey","Kind","Value"},MissingField.UseNull),
    Issues=Table.FromRecords(List.Combine(List.Transform(Records,each [Issues])),{"SubmissionKey","Field","Issue"},MissingField.UseNull)
in [Input=Keyed,Submissions=Summaries,Dates=Dates,Members=Memberships,Issues=Issues]
