"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowDown, ArrowUp, Medal, TrendingUp } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { fetchLeaderboard, TeamMember } from "../services/leaderboardService"

export default function SalesLeaderboard() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [sortField, setSortField] = useState<"sales" | "conversion" | "avgValue">("sales")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [selectedTeam, setSelectedTeam] = useState<string>("all")
  const [timeframe, setTimeframe] = useState<string>("month")

  useEffect(() => {
    fetchLeaderboard().then(setTeamMembers)
  }, [])

  // Sort and filter team members
  const sortedTeamMembers = [...teamMembers]
    .filter((member) => selectedTeam === "all" || member.team === selectedTeam)
    .sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue
    })

  // Handle sort change
  const handleSort = (field: "sales" | "conversion" | "avgValue") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  // Get rank badge based on position
  const getRankBadge = (index: number) => {
    if (index === 0) return <Medal className="h-5 w-5 text-yellow-500" />
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />
    if (index === 2) return <Medal className="h-5 w-5 text-amber-700" />
    return <span className="font-medium">{index + 1}</span>
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>Salgsrangering</CardTitle>
            <CardDescription>Se hvem som leder i salgsytelse</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {selectedTeam === "all" ? "Alle Team" : selectedTeam}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSelectedTeam("all")}>Alle Team</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedTeam("NF - Oslo")}>NF - Oslo</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedTeam("NF - Bergen")}>NF - Bergen</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {timeframe === "month" ? "Denne Måneden" : timeframe === "week" ? "Denne Uken" : "I Dag"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setTimeframe("today")}>I Dag</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTimeframe("week")}>Denne Uken</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTimeframe("month")}>Denne Måneden</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Rang</TableHead>
                <TableHead>Teammedlem</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("sales")}>
                  <div className="flex items-center gap-1">
                    Salg
                    {sortField === "sales" &&
                      (sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("conversion")}>
                  <div className="flex items-center gap-1">
                    Konvertering %
                    {sortField === "conversion" &&
                      (sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("avgValue")}>
                  <div className="flex items-center gap-1">
                    Gj.snitt Verdi
                    {sortField === "avgValue" &&
                      (sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </div>
                </TableHead>
                <TableHead>Fremgang</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTeamMembers.map((member, index) => (
                <TableRow key={member.id}>
                  <TableCell className="text-center">{getRankBadge(index)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.name} />
                        <AvatarFallback>{member.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{member.team}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {member.sales}
                      {member.trend === "up" ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <ArrowDown className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{member.conversion}%</TableCell>
                  <TableCell>{member.avgValue} kr</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Progress value={(member.sales / member.target) * 100} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{member.sales}</span>
                        <span>{member.target}</span>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
