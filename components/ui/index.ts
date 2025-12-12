// Barrel exports para componentes UI
// Centraliza todos los exports para simplificar imports

// Componentes principales
export { Button } from './Button';
export { Card, CardContent, CardHeader, CardTitle, CardDescription } from './card';
export { Input } from './Input';
export { Label } from './label';
export { Textarea } from './textarea';
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
export { Checkbox } from './checkbox';
export { Badge } from './badge';
export { Skeleton } from './skeleton';
export { Switch } from './switch';
export { Separator } from './separator';

// Componentes de imágenes (unificado)
export { ImageManager } from './ImageManager';

// Componentes de navegación y layout
export { Breadcrumb } from './Breadcrumb';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';
export { Tooltip } from './Tooltip';

// Componentes de feedback
export { useToast } from './use-toast';

// Componentes de formularios
// export { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from './form';

// Componentes de datos
// export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

// Componentes de diálogo
// export { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './dialog';

// Componentes de utilidad
// export { Separator } from './separator';
// export { Loading } from './Loading';

// Re-exports para compatibilidad (marcados como deprecated)
// @deprecated Usar ImageManager en su lugar
// export { ImageSingle } from './ImageSingle';
// @deprecated Usar ImageManager en su lugar  
// export { ImageUpload } from './ImageUpload';
// @deprecated Usar ImageManager en su lugar
// export { ImageReorder } from './ImageReorder';
