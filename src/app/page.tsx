"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuthContext } from "@/components/AuthProvider";

type AgentStats = {
  agent_id: string
  agent_name: string
  worked_contacts: number
  activities: number
  calls: number
  whatsapp: number
  emails: number
  meetings: number
  notes: number
  news: number
  valuations: number
  listings: number
}

type DashboardStats = {
  contactedToday: number
  contactedWeek: number
  totalActivities: number
  newLeads: number
  valuations: number
  listings: number
}

export default function DashboardPage() {

  const auth = useAuthContext()

  const [loading,setLoading] = useState(true)

  const [stats,setStats] = useState<DashboardStats>({
    contactedToday:0,
    contactedWeek:0,
    totalActivities:0,
    newLeads:0,
    valuations:0,
    listings:0
  })

  const [agents,setAgents] = useState<AgentStats[]>([])

  const role = String(auth.role || "").toLowerCase()

  const isAdmin = role === "admin" || role === "manager"

  useEffect(()=>{
    loadDashboard()
  },[auth.userId])

  async function loadDashboard(){

    if(!auth.userId || !auth.organizationId) return

    setLoading(true)

    const today = new Date()
    const todayStart = new Date(today.setHours(0,0,0,0)).toISOString()

    const week = new Date()
    week.setDate(week.getDate()-7)
    const weekStart = week.toISOString()

    let activityQuery = supabase
      .from("contact_activities")
      .select("activity_type, created_at, contact_id, created_by")

    if(!isAdmin){
      activityQuery = activityQuery.eq("created_by",auth.userId)
    }

    const {data:activities} = await activityQuery

    let contactedToday = 0
    let contactedWeek = 0
    let totalActivities = activities?.length || 0

    const agentMap:Record<string,AgentStats> = {}

    activities?.forEach(a=>{

      const created = new Date(a.created_at)

      if(created >= new Date(todayStart)) contactedToday++
      if(created >= new Date(weekStart)) contactedWeek++

      const agentId = a.created_by || "unknown"

      if(!agentMap[agentId]){
        agentMap[agentId] = {
          agent_id:agentId,
          agent_name:"Agente",
          worked_contacts:0,
          activities:0,
          calls:0,
          whatsapp:0,
          emails:0,
          meetings:0,
          notes:0,
          news:0,
          valuations:0,
          listings:0
        }
      }

      const agent = agentMap[agentId]

      agent.activities++

      if(a.activity_type==="call") agent.calls++
      if(a.activity_type==="whatsapp") agent.whatsapp++
      if(a.activity_type==="email") agent.emails++
      if(a.activity_type==="meeting") agent.meetings++
      if(a.activity_type==="note") agent.notes++

    })

    const {data:contacts} = await supabase
      .from("contacts")
      .select("lead_status,assigned_agent_id")

    let newLeads = 0
    let valuations = 0
    let listings = 0

    contacts?.forEach(c=>{

      if(c.lead_status==="nuovo") newLeads++

      if(c.lead_status==="valutazione effettuata") valuations++

      if(c.lead_status==="incarico preso") listings++

      const agentId = c.assigned_agent_id

      if(agentId && agentMap[agentId]){
        agentMap[agentId].worked_contacts++
      }

    })

    setStats({
      contactedToday,
      contactedWeek,
      totalActivities,
      newLeads,
      valuations,
      listings
    })

    setAgents(Object.values(agentMap))

    setLoading(false)
  }

  return(
    <div style={{padding:40}}>

      <h1 style={{marginBottom:30}}>Dashboard</h1>

      {loading && <div>Caricamento...</div>}

      {!loading && (
        <>
        <div style={grid}>

          <Stat title="Contatti lavorati oggi" value={stats.contactedToday}/>
          <Stat title="Contatti lavorati settimana" value={stats.contactedWeek}/>
          <Stat title="Attività totali" value={stats.totalActivities}/>
          <Stat title="Lead nuovi" value={stats.newLeads}/>
          <Stat title="Valutazioni fatte" value={stats.valuations}/>
          <Stat title="Incarichi presi" value={stats.listings}/>

        </div>

        <h2 style={{marginTop:40}}>Performance agenti</h2>

        <table style={table}>

          <thead>
            <tr>
              <th>Agente</th>
              <th>Contatti lavorati</th>
              <th>Attività</th>
              <th>Chiamate</th>
              <th>WhatsApp</th>
              <th>Email</th>
              <th>Incontri</th>
              <th>Note</th>
            </tr>
          </thead>

          <tbody>

            {agents.map(a=>(
              <tr key={a.agent_id}>
                <td>{a.agent_name}</td>
                <td>{a.worked_contacts}</td>
                <td>{a.activities}</td>
                <td>{a.calls}</td>
                <td>{a.whatsapp}</td>
                <td>{a.emails}</td>
                <td>{a.meetings}</td>
                <td>{a.notes}</td>
              </tr>
            ))}

          </tbody>

        </table>
        </>
      )}

    </div>
  )
}

function Stat({title,value}:{title:string,value:number}){

  return(
    <div style={card}>
      <div style={{opacity:0.6,fontSize:14}}>{title}</div>
      <div style={{fontSize:34,fontWeight:700}}>{value}</div>
    </div>
  )

}

const grid={
  display:"grid",
  gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",
  gap:20
}

const card={
  background:"#fff",
  border:"1px solid #eee",
  padding:20,
  borderRadius:12
}

const table={
  width:"100%",
  marginTop:20,
  borderCollapse:"collapse" as const
}