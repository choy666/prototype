'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, TrendingUp, Users, Package, DollarSign } from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'
import { Bar, Line, Pie } from 'react-chartjs-2'


ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

interface SalesData {
  period: string
  sales: number
  orders: number
}

interface ProductData {
  name: string
  sold: number
}

interface UserData {
  period: string
  activeUsers: number
  newUsers: number
}

interface TotalsData {
  totalSales: number
  totalOrders: number
}

export default function ReportsPage() {
  const [salesPeriod, setSalesPeriod] = useState('month')
  const [userPeriod, setUserPeriod] = useState('month')
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [productData, setProductData] = useState<ProductData[]>([])
  const [userData, setUserData] = useState<UserData[]>([])
  const [totalsData, setTotalsData] = useState<TotalsData>({ totalSales: 0, totalOrders: 0 })
  const [loading, setLoading] = useState(true)

  const fetchReportsData = useCallback(async () => {
    setLoading(true)
    try {
      const [salesRes, productsRes, usersRes, totalsRes] = await Promise.all([
        fetch(`/api/admin/reports/sales?period=${salesPeriod}`),
        fetch('/api/admin/reports/products'),
        fetch(`/api/admin/reports/users?period=${userPeriod}`),
        fetch('/api/admin/reports/totals')
      ])

      const [sales, products, users, totals] = await Promise.all([
        salesRes.json(),
        productsRes.json(),
        usersRes.json(),
        totalsRes.json()
      ])

      setSalesData(sales)
      setProductData(products)
      setUserData(users)
      setTotalsData(totals)
    } catch (error) {
      console.error('Error fetching reports data:', error)
    } finally {
      setLoading(false)
    }
  }, [salesPeriod, userPeriod])

  useEffect(() => {
    fetchReportsData()
  }, [salesPeriod, userPeriod, fetchReportsData])



  const salesChartData = {
    labels: salesData.map(d => d.period),
    datasets: [
      {
        label: 'Ventas ($)',
        data: salesData.map(d => d.sales),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
      },
      {
        label: 'Pedidos',
        data: salesData.map(d => d.orders),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.1,
      },
    ],
  }

  const productsChartData = {
    labels: productData.map(d => d.name),
    datasets: [
      {
        label: 'Productos Vendidos',
        data: productData.map(d => d.sold),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 205, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
        ],
      },
    ],
  }

  const usersChartData = {
    labels: userData.map(d => d.period),
    datasets: [
      {
        label: 'Usuarios Activos',
        data: userData.map(d => d.activeUsers),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
      },
      {
        label: 'Nuevos Usuarios',
        data: userData.map(d => d.newUsers),
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.2)',
      },
    ],
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Reportes</h1>
        </div>
        <div className="grid gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reportes</h1>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span className="text-sm font-medium">Período de Ventas:</span>
          <Select value={salesPeriod} onValueChange={setSalesPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mes</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="year">Año</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">Período de Usuarios:</span>
          <Select value={userPeriod} onValueChange={setUserPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mes</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="year">Año</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Ventas por período */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Ventas por Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Line data={salesChartData} options={{ responsive: true, maintainAspectRatio: false }} height={300} />
          </CardContent>
        </Card>

        {/* Productos más vendidos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Productos Más Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Pie data={productsChartData} options={{ responsive: true, maintainAspectRatio: false }} height={300} />
          </CardContent>
        </Card>

        {/* Usuarios activos */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Usuarios Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Bar data={usersChartData} options={{ responsive: true, maintainAspectRatio: false }} height={300} />
          </CardContent>
        </Card>
      </div>

      {/* Resumen de métricas */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ventas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalsData.totalSales.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pedidos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalsData.totalOrders}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userData.reduce((sum, d) => sum + d.activeUsers, 0)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
