"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, ListFilter } from "lucide-react"
import { fetchRapport, RapportRecord } from "../services/rapportService"

export default function RapportTable() {
  const [rapport, setRapport] = useState<RapportRecord[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClient, setSelectedClient] = useState("all")

  useEffect(() => {
    fetchRapport().then(setRapport)
  }, [])

  // Get unique clients for filter
  const uniqueClients = Array.from(new Set(rapport.map((item) => item.client)))

  // Filter data based on search term and client
  const filteredData = rapport.filter((item) => {
    const matchesSearch =
      item.agent.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.campaign.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.client.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesClient = selectedClient === "all" || item.client === selectedClient
    return matchesSearch && matchesClient
  })

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>Rapport</CardTitle>
            <CardDescription>Detaljert oversikt over agentytelse</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10">
                  <ListFilter className="mr-2 h-4 w-4" />
                  {selectedClient === "all" ? "Alle Klienter" : selectedClient}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSelectedClient("all")}>Alle Klienter</DropdownMenuItem>
                {uniqueClients.map((client) => (
                  <DropdownMenuItem key={client} onClick={() => setSelectedClient(client)}>
                    {client}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="relative flex-1 min-w-[200px]">
              <Input
                type="search"
                placeholder="Søk agent, kampanje..."
                className="pl-4"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" className="h-10">
              <Download className="mr-2 h-4 w-4" />
              Eksporter
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Klient</TableHead>
                <TableHead>Kampanje</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>O.</TableHead>
                <TableHead>O..</TableHead>
                <TableHead>Pr.</TableHead>
                <TableHead>SMS Pr.</TableHead>
                <TableHead>Con.</TableHead>
                <TableHead>Trans.</TableHead>
                <TableHead>Conver.</TableHead>
                <TableHead>S.</TableHead>
                <TableHead>Y.</TableHead>
                <TableHead>C.</TableHead>
                <TableHead>O...</TableHead>
                <TableHead>Y..</TableHead>
                <TableHead>L.</TableHead>
                <TableHead>Pa.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.client}</TableCell>
                  <TableCell>{item.campaign}</TableCell>
                  <TableCell>{item.agent}</TableCell>
                  <TableCell>{item.o1}</TableCell>
                  <TableCell>{item.o2}</TableCell>
                  <TableCell>{item.o3}</TableCell>
                  <TableCell>{item.smsPr}</TableCell>
                  <TableCell>{item.con}</TableCell>
                  <TableCell>{item.trans}</TableCell>
                  <TableCell>{item.conver}</TableCell>
                  <TableCell>{item.s}</TableCell>
                  <TableCell>{item.y1}</TableCell>
                  <TableCell>{item.y2}</TableCell>
                  <TableCell>{item.y3}</TableCell>
                  <TableCell>{item.y4}</TableCell>
                  <TableCell>{item.y5}</TableCell>
                  <TableCell>{item.y6}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Viser {(currentPage - 1) * pageSize + 1} til {Math.min(currentPage * pageSize, filteredData.length)} av{" "}
              {filteredData.length}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {pageSize} per side
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setPageSize(10)}>10 per side</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPageSize(20)}>20 per side</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPageSize(50)}>50 per side</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPageSize(100)}>100 per side</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm mx-2">
              Side {currentPage} av {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
