'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MLCategorySelectSimple } from '@/components/admin/MLCategorySelectSimple';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Save,
  Package,
  Tag,
  CheckCircle,
  AlertCircle,
  Camera,
  Truck,
  Star,
  AlertTriangle,
  CheckSquare,
  Square,
} from 'lucide-react';

import { ImageManager } from '@/components/ui/ImageManager';
import { ME2Guidelines } from '@/components/admin/ME2Guidelines';
import { MLAttributesGuide } from '@/components/admin/MLAttributesGuide';
import { ShippingAttributesForm } from '@/components/admin/ShippingAttributesForm';
import { Badge } from '@/components/ui/badge';
import {
  getValidations,
  isME2Ready,
  type ProductForm,
  type DynamicAttribute,
} from '@/lib/validations/product-validations';
import type { ShippingAttributesInput } from '@/lib/validations/shipping-attributes';
import { validateProductForMercadoLibre } from '@/lib/actions/product-validation';
import type { Category } from '@/lib/schema';
import {
  evaluateCategoryAttributeRequirements,
  type AttributeRequirementResult,
  type CategoryAttributeDefinition,
} from '@/lib/mercado-envios/attribute-requirements';

type ListingTypeSource = 'user' | 'category' | 'site';

interface ListingTypeOption {
  id: string;
  name?: string;
  saleFeePercent?: number;
  saleFeeCurrency?: string;
  saleFeeAmount?: number;
  priceRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  remainingListings?: number | null;
  available: boolean;
  blockedReason?: string;
  source: ListingTypeSource;
}

interface Me2Config {
  minDimensions: Record<'height' | 'width' | 'length' | 'weight', number>;
  maxDimensions: Record<'height' | 'width' | 'length' | 'weight', number>;
  defaultDimensions: Record<'height' | 'width' | 'length' | 'weight', number>;
  packagingCost: number;
  handlingCost: number;
}

export default function NewProductPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [listingTypeOptions, setListingTypeOptions] = useState<ListingTypeOption[]>([]);
  const [listingTypesSource, setListingTypesSource] = useState<ListingTypeSource | null>(null);
  const [listingTypesLoading, setListingTypesLoading] = useState(false);
  const [listingTypesError, setListingTypesError] = useState<string | null>(null);
  const [listingTypeSelectionWarning, setListingTypeSelectionWarning] = useState<string | null>(
    null
  );
  const [listingTypePriceWarning, setListingTypePriceWarning] = useState<string | null>(null);
  const [listingTypeNeedsManualSelection, setListingTypeNeedsManualSelection] = useState(false);
  const [focusedSection, setFocusedSection] = useState<string>('');
  const [attributes, setAttributes] = useState<DynamicAttribute[]>([]);
  const [recommendedAttributes, setRecommendedAttributes] = useState<
    { key: string; label: string; aliases: string[]; required?: boolean }[]
  >([]);
  const [me2Config, setMe2Config] = useState<Me2Config | null>(null);
  const [me2ConfigLoading, setMe2ConfigLoading] = useState(true);
  const [me2ConfigError, setMe2ConfigError] = useState<string | null>(null);
  const [me2ValidationWarnings, setMe2ValidationWarnings] = useState<string[]>([]);
  const [categoryAttributeDefinitions, setCategoryAttributeDefinitions] = useState<
    CategoryAttributeDefinition[]
  >([]);
  const [attributeEvaluation, setAttributeEvaluation] = useState<AttributeRequirementResult | null>(
    null
  );

  const listingTypeSourceLabel: Record<ListingTypeSource, string> = {
    user: 'Cuenta + categoría',
    category: 'Restricciones de categoría',
    site: 'Configuración del sitio',
  };

  const currentListingTypeWarning = listingTypeSelectionWarning ?? listingTypePriceWarning;

  const [form, setForm] = useState<ProductForm>({
    name: '',
    description: '',
    price: '',
    image: '',
    images: [],
    discount: '0',
    weight: '',
    stock: '0',
    destacado: false,
    // Valores por defecto para Mercado Libre
    mlCondition: 'new',
    mlBuyingMode: 'buy_it_now',
    mlListingTypeId: 'free',
    mlCurrencyId: 'ARS',
    mlCategoryId: '',
    warranty: '',
    videoId: '',
    // Dimensiones
    height: '',
    width: '',
    length: '',
    // Nuevos campos ME2
    me2Compatible: false,
    shippingMode: 'me2',
    shippingAttributes: undefined,
  });

  const mlCategories = useMemo(
    () =>
      categories.filter(
        (category) => category.mlCategoryId && category.isMlOfficial && category.isLeaf
      ),
    [categories]
  );

  const validations = getValidations(form, attributes, recommendedAttributes);
  const requiredValidations = validations.filter((v) => v.isRequired).length;
  const completedRequired = validations.filter((v) => v.isRequired && v.isValid).length;
  const readinessScore =
    requiredValidations === 0 ? 100 : Math.round((completedRequired / requiredValidations) * 100);

  const missingRequiredCount = attributeEvaluation?.missingRequired.length ?? 0;
  const missingConditionalCount = attributeEvaluation?.missingConditional.length ?? 0;
  const invalidAttributeValues = attributeEvaluation?.invalidValues ?? [];
  const hasInvalidAttributes = invalidAttributeValues.length > 0;
  const hasBlockingAttributeIssues =
    missingRequiredCount > 0 || missingConditionalCount > 0 || hasInvalidAttributes;

  const getReadinessColor = () => {
    if (readinessScore === 100) return 'text-emerald-400 bg-emerald-950/50 border-emerald-800/50';
    if (readinessScore >= 70) return 'text-amber-400 bg-amber-950/50 border-amber-800/50';
    return 'text-red-400 bg-red-950/50 border-red-800/50';
  };

  const selectedListingType = useMemo(
    () => listingTypeOptions.find((lt) => lt.id === form.mlListingTypeId),
    [listingTypeOptions, form.mlListingTypeId]
  );

  const setMlListingTypeId = (value: string) => {
    setForm((prev: ProductForm) =>
      prev.mlListingTypeId === value ? prev : { ...prev, mlListingTypeId: value }
    );
  };

  const handleShippingAttributesChange = (value?: ShippingAttributesInput) => {
    setForm((prev: ProductForm) => ({
      ...prev,
      shippingAttributes: value,
    }));
  };

  const getReadinessIcon = () => {
    if (readinessScore === 100) return <CheckCircle className='h-5 w-5' />;
    if (readinessScore >= 70) return <AlertTriangle className='h-5 w-5' />;
    return <AlertCircle className='h-5 w-5' />;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const categoriesRes = await fetch('/api/admin/categories');

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchMe2Config = async () => {
      setMe2ConfigLoading(true);
      setMe2ConfigError(null);
      try {
        const res = await fetch('/api/mercadolibre/me2-config');
        if (!res.ok) {
          throw new Error('No se pudo obtener la configuración ME2');
        }
        const data = await res.json();
        setMe2Config(data);
      } catch (error) {
        setMe2ConfigError(error instanceof Error ? error.message : 'Error desconocido');
      } finally {
        setMe2ConfigLoading(false);
      }
    };
    fetchMe2Config();
  }, []);

  useEffect(() => {
    if (!form.mlCategoryId) {
      setListingTypeSelectionWarning(null);
      return;
    }

    if (listingTypeOptions.length === 0) {
      setListingTypeSelectionWarning(
        listingTypesLoading ? null : 'No recibimos tipos de publicación para esta categoría.'
      );
      return;
    }

    if (!form.mlListingTypeId) {
      if (listingTypeNeedsManualSelection) {
        setListingTypeSelectionWarning('Selecciona un tipo de publicación disponible.');
        return;
      }
      const firstAvailable = listingTypeOptions.find((lt) => lt.available);
      if (firstAvailable) {
        setMlListingTypeId(firstAvailable.id);
        setListingTypeSelectionWarning(null);
      } else {
        setListingTypeSelectionWarning(
          'No hay tipos con cupos disponibles para esta categoría. Revisa tu cuenta de Mercado Libre.'
        );
      }
      return;
    }

    const selected = listingTypeOptions.find((lt) => lt.id === form.mlListingTypeId);
    if (!selected || !selected.available) {
      setListingTypeNeedsManualSelection(true);
      setListingTypeSelectionWarning(
        selected?.blockedReason ||
          'El tipo de publicación guardado ya no está disponible. Selecciona uno nuevo.'
      );
      setMlListingTypeId('');
      return;
    }

    setListingTypeSelectionWarning(null);
  }, [
    form.mlCategoryId,
    form.mlListingTypeId,
    listingTypeOptions,
    listingTypeNeedsManualSelection,
    listingTypesLoading,
  ]);

  useEffect(() => {
    if (!selectedListingType) {
      setListingTypePriceWarning(null);
      return;
    }

    const numericPrice = parseFloat(form.price);
    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      setListingTypePriceWarning(null);
      return;
    }

    if (selectedListingType.priceRange) {
      const { min, max, currency } = selectedListingType.priceRange;
      if (typeof min === 'number' && numericPrice < min) {
        setListingTypePriceWarning(
          `El precio debe ser al menos ${min.toFixed(2)} ${currency ?? ''} para ${selectedListingType.name ?? selectedListingType.id}.`
        );
        return;
      }
      if (typeof max === 'number' && numericPrice > max) {
        setListingTypePriceWarning(
          `El precio máximo permitido para ${selectedListingType.name ?? selectedListingType.id} es ${max.toFixed(2)} ${currency ?? ''}.`
        );
        return;
      }
    }

    setListingTypePriceWarning(null);
  }, [form.price, selectedListingType]);

  const { mlCategoryId, mlListingTypeId } = form;

  useEffect(() => {
    let isActive = true;
    const fetchListingTypes = async () => {
      setListingTypesLoading(true);
      setListingTypesError(null);
      try {
        const query = mlCategoryId ? `?categoryId=${mlCategoryId}` : '';
        const res = await fetch(`/api/mercadolibre/listing-types${query}`);
        if (!res.ok) {
          throw new Error('No se pudieron obtener los tipos de publicación disponibles');
        }
        const data = await res.json();
        if (!isActive) {
          return;
        }

        const options: ListingTypeOption[] = Array.isArray(data.listingTypes)
          ? data.listingTypes.map((lt: ListingTypeOption) => ({
              id: lt.id,
              name: lt.name ?? lt.id,
              saleFeePercent: typeof lt.saleFeePercent === 'number' ? lt.saleFeePercent : undefined,
              saleFeeCurrency: lt.saleFeeCurrency,
              saleFeeAmount: lt.saleFeeAmount,
              priceRange: lt.priceRange,
              remainingListings:
                typeof lt.remainingListings === 'number' ? lt.remainingListings : null,
              available: lt.available !== false,
              blockedReason: lt.blockedReason,
              source: lt.source ?? data.source ?? 'site',
            }))
          : [];

        setListingTypeOptions(options);
        setListingTypesSource((data.source as ListingTypeSource) ?? null);
        setListingTypeSelectionWarning(null);
        setListingTypePriceWarning(null);
      } catch (error) {
        if (!isActive) return;
        setListingTypeOptions([]);
        setListingTypesSource(null);
        setListingTypeSelectionWarning(
          error instanceof Error ? error.message : 'Error desconocido'
        );
        setListingTypesError(error instanceof Error ? error.message : 'Error desconocido');
      } finally {
        if (isActive) {
          setListingTypesLoading(false);
        }
      }
    };

    fetchListingTypes();

    return () => {
      isActive = false;
    };
  }, [mlCategoryId, mlListingTypeId]);

  useEffect(() => {
    const fetchRecommendedAttributes = async () => {
      if (!form.mlCategoryId) {
        setRecommendedAttributes([]);
        setCategoryAttributeDefinitions([]);
        setAttributeEvaluation(null);
        return;
      }

      try {
        // Forzar recarga limpiando posible cache stale
        const url = `/api/mercadolibre/categories/${form.mlCategoryId}/attributes?t=${Date.now()}`;
        const res = await fetch(url);
        if (!res.ok) {
          setRecommendedAttributes([]);
          setCategoryAttributeDefinitions([]);
          setAttributeEvaluation(null);
          return;
        }
        const data = await res.json();
        setRecommendedAttributes(data.attributes || []);
        const definitionSource = (data?.mlAttributes?.all ??
          data?.rawAttributes ??
          []) as CategoryAttributeDefinition[];
        setCategoryAttributeDefinitions(definitionSource);
      } catch {
        setRecommendedAttributes([]);
        setCategoryAttributeDefinitions([]);
        setAttributeEvaluation(null);
      }
    };

    fetchRecommendedAttributes();
  }, [form.mlCategoryId]);

  useEffect(() => {
    if (!categoryAttributeDefinitions || categoryAttributeDefinitions.length === 0) {
      setAttributeEvaluation(null);
      return;
    }
    const evaluation = evaluateCategoryAttributeRequirements(
      attributes,
      categoryAttributeDefinitions
    );
    setAttributeEvaluation(evaluation);
  }, [attributes, categoryAttributeDefinitions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMe2ValidationWarnings([]);

    try {
      if (mlCategories.length === 0) {
        throw new Error(
          'No hay categorías oficiales de Mercado Libre. Ve a "Categorías" y usa "Actualizar desde Mercado Libre".'
        );
      }

      if (!form.mlCategoryId) {
        throw new Error('Debes seleccionar una categoría de Mercado Libre');
      }

      if (readinessScore < 100) {
        throw new Error('Completa todos los campos obligatorios antes de crear el producto');
      }

      if (hasBlockingAttributeIssues) {
        throw new Error(
          'Completa todos los atributos obligatorios o corrige los valores inválidos antes de crear el producto'
        );
      }

      // Validación completa para Mercado Libre
      const productForValidation = {
        id: 0, // Temporal para validación
        name: form.name,
        description: form.description,
        price: form.price,
        image: form.image,
        images: form.images,
        stock: String(form.stock || '0'),
        mlCategoryId: form.mlCategoryId,
        mlCondition: form.mlCondition,
        mlBuyingMode: form.mlBuyingMode,
        mlListingTypeId: form.mlListingTypeId,
        mlCurrencyId: form.mlCurrencyId,
        weight: form.weight,
        height: form.height,
        width: form.width,
        length: form.length,
        shippingMode: form.shippingMode || undefined,
        me2Compatible: isME2Ready(form),
        attributes: attributes,
        shippingAttributes: form.shippingAttributes ?? null,
        // Campos necesarios pero no usados en validación
        category: '',
        categoryId: 0,
        discount: String(form.discount || '0'),
        destacado: false,
        isActive: true,
        created_at: new Date(),
        updated_at: new Date(),
        mlItemId: undefined,
        mlSyncStatus: 'pending',
        mlLastSync: null,
        mlPermalink: null,
        mlThumbnail: null,
        mlVideoId: form.videoId || null,
        videoId: form.videoId || '',
        warranty: form.warranty || '',
      };

      const mlValidationResult = await validateProductForMercadoLibre(productForValidation);
      setMe2ValidationWarnings(mlValidationResult.validation?.warnings ?? []);

      // Agregar logs para debugging
      console.log('Resultado de validación ML:', mlValidationResult);

      if (!mlValidationResult.success) {
        // Mostrar el error específico devuelto por la validación
        const errorMessage = mlValidationResult.error || 'Error de validación desconocido';
        console.error('Error de validación ML:', errorMessage);
        throw new Error(
          `El producto no cumple los requisitos de Mercado Libre:\n\n• ${errorMessage}`
        );
      }

      if (!mlValidationResult.validation?.isValid) {
        const errorMessage = `El producto no cumple los requisitos de Mercado Libre:\n\n• ${mlValidationResult.validation?.errors?.join('\n• ') || 'Error de validación'}`;
        console.error('Errores de validación:', mlValidationResult.validation?.errors);
        throw new Error(errorMessage);
      }

      if (!mlValidationResult.validation?.isReadyForSync) {
        const warningMessage = `Advertencias para sincronización:\n\n• ${mlValidationResult.validation?.warnings?.join('\n• ') || ''}`;
        toast({
          title: 'Advertencias de Mercado Libre',
          description: warningMessage,
          variant: 'default',
        });
      }

      const productData = {
        name: form.name,
        description: form.description || undefined,
        price: form.price,
        image: form.image || undefined,
        images: form.images,
        discount: String(form.discount || '0'),
        weight: form.weight || undefined,
        stock: parseInt(form.stock) || 0,
        destacado: form.destacado,
        attributes: attributes.length > 0 ? attributes : undefined,
        // Campos de Mercado Libre
        mlCondition: form.mlCondition,
        mlBuyingMode: form.mlBuyingMode,
        mlListingTypeId: form.mlListingTypeId,
        mlCurrencyId: form.mlCurrencyId,
        mlCategoryId: form.mlCategoryId,
        warranty: form.warranty || undefined,
        mlVideoId: form.videoId || undefined,
        // Dimensiones para envío
        height: form.height || undefined,
        width: form.width || undefined,
        length: form.length || undefined,
        // Campos ME2
        me2Compatible: mlValidationResult.validation?.isReadyForSync || false,
        shippingMode: form.shippingMode,
        shippingAttributes: form.shippingAttributes ?? undefined,
      };

      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create product');
      }

      if (mlValidationResult.validation?.isReadyForSync) {
        toast({
          title: '✅ ¡Producto creado y listo para sincronizar! 🎉',
          description:
            'El producto cumple todos los requisitos de Mercado Libre y puede sincronizarse inmediatamente.',
        });
      } else {
        toast({
          title: '¡Producto creado! 🎉',
          description:
            'El producto está listo para sincronizarse con Mercado Libre. Todos los requisitos han sido cumplidos.',
        });
      }

      router.push('/admin/products');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo crear el producto',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof ProductForm, value: string | boolean) => {
    if (field === 'mlListingTypeId') {
      setListingTypeNeedsManualSelection(false);
      setListingTypeSelectionWarning(null);
      setListingTypePriceWarning(null);
    }
    setForm((prev: ProductForm) => ({ ...prev, [field]: value }));
  };

  const handleImagesReorder = (images: string[]) => {
    setForm((prev: ProductForm) => ({ ...prev, images }));
  };

  const handleMlCategoryChange = (categoryId: string) => {
    const category = categories.find((category) => category.id.toString() === categoryId);
    setListingTypeNeedsManualSelection(false);
    setListingTypeSelectionWarning(null);
    setListingTypePriceWarning(null);
    if (category) {
      setForm((prev: ProductForm) => ({
        ...prev,
        mlCategoryId: category.mlCategoryId || categoryId,
        mlCondition: 'new',
        mlBuyingMode: 'buy_it_now',
        mlListingTypeId: '',
        mlCurrencyId: 'ARS',
      }));
    } else {
      setForm((prev: ProductForm) => ({ ...prev, mlCategoryId: categoryId, mlListingTypeId: '' }));
    }
  };

  // Scroll to section
  const scrollToSection = (sectionId: string) => {
    setFocusedSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className='min-h-screen bg-dark dark:bg-dark'>
      {/* Header con indicador de progreso */}
      <div className='sticky top-0 z-40 bg-dark/95 backdrop-blur supports-[backdrop-filter]:bg-dark/60 border-b border-dark-lighter'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center justify-between h-16'>
            <div className='flex items-center space-x-4'>
              <Link href='/admin/products'>
                <Button variant='ghost' size='sm' className='lg:hidden'>
                  <ArrowLeft className='h-4 w-4' />
                </Button>
              </Link>
              <div>
                <h1 className='text-xl font-semibold text-dark-text-primary'>Crear Producto</h1>
                <p className='text-sm text-dark-text-secondary'>
                  Completa todos los requisitos para Mercado Libre
                </p>
              </div>
            </div>

            {/* Indicator de progreso */}
            <div
              className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${getReadinessColor()}`}
            >
              {getReadinessIcon()}
              <div className='text-right'>
                <div className='text-sm font-medium'>{readinessScore}% Completo</div>
                <div className='text-xs opacity-75'>
                  {completedRequired}/{requiredValidations} obligatorios
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        <div className='grid grid-cols-1 lg:grid-cols-4 gap-8'>
          {/* Sidebar con checklist */}
          <div className='lg:col-span-1'>
            <Card className='sticky top-24 bg-dark-lighter border-dark-lighter'>
              <CardHeader className='pb-3'>
                <CardTitle className='text-lg flex items-center gap-2 text-dark-text-primary'>
                  <CheckSquare className='h-5 w-5' />
                  Checklist ML
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-2'>
                {validations.map((validation) => (
                  <div
                    key={validation.field}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer
                      ${validation.isValid ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-800/30' : 'bg-dark-lightest text-dark-text-secondary border border-dark-lighter'}
                      ${focusedSection === validation.field ? 'ring-2 ring-blue-500' : ''}
                    `}
                    onClick={() => scrollToSection(validation.field)}
                  >
                    {validation.isValid ? (
                      <CheckSquare className='h-4 w-4 flex-shrink-0' />
                    ) : (
                      <Square className='h-4 w-4 flex-shrink-0' />
                    )}
                    <div className='flex items-center gap-2 min-w-0 flex-1'>
                      {validation.icon}
                      <span className='text-sm font-medium truncate'>{validation.label}</span>
                    </div>
                    {validation.isRequired && (
                      <span className='text-xs bg-red-950/50 text-red-400 px-2 py-0.5 rounded border border-red-800/30'>
                        Req
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Formulario principal */}
          <div className='lg:col-span-3 space-y-8'>
            {/* Sección Información Básica */}
            <Card
              id='name'
              className={`transition-all bg-dark-lighter border-dark-lighter ${focusedSection === 'name' || focusedSection === 'description' || focusedSection === 'price' ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : ''}`}
            >
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-dark-text-primary'>
                  <Package className='h-5 w-5' />
                  Información Básica
                  <span className='text-sm font-normal text-dark-text-secondary'>
                    (Obligatorio)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-6'>
                <div>
                  <Label htmlFor='name' className='flex items-center gap-2 text-dark-text-primary'>
                    Nombre del producto *
                    {form.name.trim().length >= 3 ? (
                      <CheckCircle className='h-4 w-4 text-emerald-400' />
                    ) : (
                      <AlertCircle className='h-4 w-4 text-amber-400' />
                    )}
                  </Label>
                  <Input
                    id='name'
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder='Ej: Smartphone Samsung Galaxy A54 128GB'
                    required
                    className={`mt-1 ${form.name.trim().length >= 3 ? 'border-emerald-500' : ''}`}
                  />
                  <p className='text-xs text-dark-text-secondary mt-1'>
                    Mínimo 3 caracteres. Sé específico y descriptivo.
                  </p>
                </div>

                <div>
                  <Label htmlFor='price' className='flex items-center gap-2 text-dark-text-primary'>
                    Precio *
                    {parseFloat(form.price) > 0 ? (
                      <CheckCircle className='h-4 w-4 text-emerald-400' />
                    ) : (
                      <AlertCircle className='h-4 w-4 text-amber-400' />
                    )}
                  </Label>
                  <Input
                    id='price'
                    type='number'
                    step='0.01'
                    min='0.01'
                    value={form.price}
                    onChange={(e) => handleChange('price', e.target.value)}
                    placeholder='0.00'
                    required
                    className={`mt-1 ${parseFloat(form.price) > 0 ? 'border-emerald-500' : ''}`}
                  />
                </div>

                <div>
                  <Label
                    htmlFor='description'
                    className='flex items-center gap-2 text-dark-text-primary'
                  >
                    Descripción *
                    {form.description.trim().length >= 50 ? (
                      <CheckCircle className='h-4 w-4 text-emerald-400' />
                    ) : (
                      <span className='text-xs text-amber-400'>
                        ({form.description.trim().length}/50 caracteres)
                      </span>
                    )}
                  </Label>
                  <Textarea
                    id='description'
                    value={form.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder='Describe tu producto con detalles: características principales, materiales, beneficios, usos recomendados...'
                    rows={6}
                    className={`mt-1 resize-y ${form.description.trim().length >= 50 ? 'border-emerald-500' : ''}`}
                  />
                  <p className='text-xs text-dark-text-secondary mt-1'>
                    Mínimo 50 caracteres. Incluye características técnicas y beneficios.
                  </p>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <div>
                    <Label htmlFor='stock' className='text-dark-text-primary'>
                      Stock disponible
                    </Label>
                    <Input
                      id='stock'
                      type='number'
                      min='0'
                      value={form.stock}
                      onChange={(e) => handleChange('stock', e.target.value)}
                      placeholder='0'
                    />
                  </div>

                  <div>
                    <Label htmlFor='discount' className='text-dark-text-primary'>
                      Descuento (%)
                    </Label>
                    <Input
                      id='discount'
                      type='number'
                      min='0'
                      max='100'
                      value={form.discount}
                      onChange={(e) => handleChange('discount', e.target.value)}
                      placeholder='0'
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sección Imágenes */}
            <Card
              id='image'
              className={`transition-all bg-dark-lighter border-dark-lighter ${focusedSection === 'image' ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : ''}`}
            >
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-dark-text-primary'>
                  <Camera className='h-5 w-5' />
                  Imágenes del Producto
                  <span className='text-sm font-normal text-dark-text-secondary'>
                    (Obligatorio)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-6'>
                <div>
                  <Label htmlFor='image' className='flex items-center gap-2 text-dark-text-primary'>
                    Imagen principal *
                    {form.image ? (
                      <CheckCircle className='h-4 w-4 text-emerald-400' />
                    ) : (
                      <AlertCircle className='h-4 w-4 text-amber-400' />
                    )}
                  </Label>
                  <div className='mt-1'>
                    <ImageManager
                      mode='single'
                      images={form.image ? [form.image] : []}
                      onImagesChange={(images) =>
                        setForm((prev: ProductForm) => ({ ...prev, image: images[0] || '' }))
                      }
                      maxImages={1}
                    />
                  </div>
                  <p className='text-xs text-dark-text-secondary mt-2'>
                    Recomendación: Mínimo 1200x1200px, fondo blanco, producto centrado.
                  </p>
                </div>

                <div>
                  <Label htmlFor='images' className='text-dark-text-primary'>
                    Imágenes adicionales (opcional)
                  </Label>
                  <div className='mt-1'>
                    <ImageManager
                      mode='reorder'
                      images={form.images}
                      onImagesChange={handleImagesReorder}
                      maxImages={10}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sección Dimensiones y Envío */}
            <Card
              id='dimensions'
              className={`transition-all bg-dark-lighter border-dark-lighter ${focusedSection === 'dimensions' ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : ''}`}
            >
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-dark-text-primary'>
                  <Truck className='h-5 w-5' />
                  Dimensiones para Envío
                  <span className='text-sm font-normal text-dark-text-secondary'>
                    (Obligatorio para ME2)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-6'>
                <div>
                  <Label className='flex items-center gap-2 mb-3 text-dark-text-primary'>
                    Dimensiones y peso *
                    {isME2Ready(form) ? (
                      <CheckCircle className='h-4 w-4 text-emerald-400' />
                    ) : (
                      <AlertCircle className='h-4 w-4 text-amber-400' />
                    )}
                  </Label>
                  <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
                    <div>
                      <Label htmlFor='height' className='text-dark-text-primary'>
                        Alto (cm)
                      </Label>
                      <Input
                        id='height'
                        type='number'
                        step='0.1'
                        min='0'
                        value={form.height}
                        onChange={(e) => handleChange('height', e.target.value)}
                        placeholder='0.0'
                        className={
                          form.height && parseFloat(form.height) > 0 ? 'border-emerald-500' : ''
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor='width' className='text-dark-text-primary'>
                        Ancho (cm)
                      </Label>
                      <Input
                        id='width'
                        type='number'
                        step='0.1'
                        min='0'
                        value={form.width}
                        onChange={(e) => handleChange('width', e.target.value)}
                        placeholder='0.0'
                        className={
                          form.width && parseFloat(form.width) > 0 ? 'border-emerald-500' : ''
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor='length' className='text-dark-text-primary'>
                        Largo (cm)
                      </Label>
                      <Input
                        id='length'
                        type='number'
                        step='0.1'
                        min='0'
                        value={form.length}
                        onChange={(e) => handleChange('length', e.target.value)}
                        placeholder='0.0'
                        className={
                          form.length && parseFloat(form.length) > 0 ? 'border-emerald-500' : ''
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor='weight' className='text-dark-text-primary'>
                        Peso (kg)
                      </Label>
                      <Input
                        id='weight'
                        type='number'
                        step='0.01'
                        min='0'
                        value={form.weight}
                        onChange={(e) => handleChange('weight', e.target.value)}
                        placeholder='0.00'
                        className={
                          form.weight && parseFloat(form.weight) > 0 ? 'border-emerald-500' : ''
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Estado ME2 */}
                <div
                  className={`p-4 rounded-lg border ${isME2Ready(form) ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-amber-950/30 border-amber-800/50'}`}
                >
                  <div className='flex items-center gap-3'>
                    {isME2Ready(form) ? (
                      <CheckCircle className='h-5 w-5 text-emerald-400' />
                    ) : (
                      <AlertCircle className='h-5 w-5 text-amber-400' />
                    )}
                    <div>
                      <p
                        className={`font-medium ${isME2Ready(form) ? 'text-emerald-300' : 'text-amber-300'}`}
                      >
                        {isME2Ready(form)
                          ? '✓ Compatible con Mercado Envíos 2'
                          : '⚠ Incompleto para ME2'}
                      </p>
                      <p className='text-sm text-dark-text-secondary opacity-75'>
                        {isME2Ready(form)
                          ? 'Tu producto podrá usar los métodos de envío más rápidos'
                          : 'Completa todas las dimensiones para activar ME2'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Guías ME2 */}
                <div className='bg-dark-lightest rounded-lg p-4 space-y-4'>
                  <ME2Guidelines
                    dimensions={{
                      height: parseFloat(form.height) || undefined,
                      width: parseFloat(form.width) || undefined,
                      length: parseFloat(form.length) || undefined,
                      weight: parseFloat(form.weight) || undefined,
                    }}
                    showWarnings={true}
                  />
                  {me2ConfigLoading && (
                    <p className='text-xs text-dark-text-secondary'>
                      Consultando límites oficiales de Mercado Envíos 2…
                    </p>
                  )}
                  {me2ConfigError && (
                    <Alert className='border-amber-800/40 bg-amber-500/10 text-amber-100'>
                      <AlertCircle className='h-4 w-4' />
                      <AlertDescription>{me2ConfigError}</AlertDescription>
                    </Alert>
                  )}
                  {me2Config && (
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-dark-text-secondary'>
                      <div className='rounded-lg border border-dark-lighter p-3'>
                        <p className='text-dark-text-primary font-medium mb-1'>
                          Mínimos requeridos
                        </p>
                        <ul className='space-y-1'>
                          <li>Alto: {me2Config.minDimensions.height} cm</li>
                          <li>Ancho: {me2Config.minDimensions.width} cm</li>
                          <li>Largo: {me2Config.minDimensions.length} cm</li>
                          <li>Peso: {me2Config.minDimensions.weight} kg</li>
                        </ul>
                      </div>
                      <div className='rounded-lg border border-dark-lighter p-3'>
                        <p className='text-dark-text-primary font-medium mb-1'>Máximos tolerados</p>
                        <ul className='space-y-1'>
                          <li>Alto: {me2Config.maxDimensions.height} cm</li>
                          <li>Ancho: {me2Config.maxDimensions.width} cm</li>
                          <li>Largo: {me2Config.maxDimensions.length} cm</li>
                          <li>Peso: {me2Config.maxDimensions.weight} kg</li>
                        </ul>
                        <p className='mt-2 text-dark-text-primary font-medium'>
                          Costos referenciales
                        </p>
                        <ul className='space-y-1'>
                          <li>Packaging: {me2Config.packagingCost}</li>
                          <li>Manejo: {me2Config.handlingCost}</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sección Atributos de Envío */}
            <Card
              id='shippingAttributes'
              className={`transition-all bg-dark-lighter border-dark-lighter ${
                focusedSection === 'shippingAttributes'
                  ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20'
                  : ''
              }`}
            >
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-dark-text-primary'>
                  <Truck className='h-5 w-5' />
                  Atributos avanzados de envío (ME2)
                </CardTitle>
                <p className='text-sm text-dark-text-secondary'>
                  Define el modo, tipo logístico y restricciones adicionales que enviaremos a
                  Mercado Libre.
                </p>
              </CardHeader>
              <CardContent className='space-y-4'>
                <ShippingAttributesForm
                  value={form.shippingAttributes as ShippingAttributesInput | undefined}
                  onChange={handleShippingAttributesChange}
                  disabled={loading}
                />
                {me2ValidationWarnings.length > 0 && (
                  <Alert className='border-amber-800/40 bg-amber-500/10 text-amber-50'>
                    <AlertCircle className='h-4 w-4' />
                    <AlertDescription className='space-y-1'>
                      {me2ValidationWarnings.map((warning, index) => (
                        <div key={`me2-warning-${index}`}>• {warning}</div>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}
                {form.shippingAttributes && (
                  <p className='text-xs text-dark-text-secondary'>
                    Estos parámetros se incluirán en la solicitud de publicación para respetar el
                    plan oficial de integraciones.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Sección Categoría y Configuración ML */}
            <Card
              id='mlCategoryId'
              className={`transition-all bg-dark-lighter border-dark-lighter ${focusedSection === 'mlCategoryId' || focusedSection === 'mlCondition' || focusedSection === 'mlBuyingMode' || focusedSection === 'mlListingTypeId' ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : ''}`}
            >
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-dark-text-primary'>
                  <Tag className='h-5 w-5' />
                  Configuración Mercado Libre
                  <span className='text-sm font-normal text-dark-text-secondary'>
                    (Obligatorio)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-6'>
                <div>
                  <Label
                    htmlFor='mlCategoryId'
                    className='flex items-center gap-2 text-dark-text-primary'
                  >
                    Categoría Mercado Libre *
                    {form.mlCategoryId ? (
                      <CheckCircle className='h-4 w-4 text-emerald-400' />
                    ) : (
                      <AlertCircle className='h-4 w-4 text-amber-400' />
                    )}
                  </Label>
                  <MLCategorySelectSimple
                    value={form.mlCategoryId}
                    onValueChange={handleMlCategoryChange}
                    categories={categories}
                    placeholder='Seleccionar categoría ML'
                    disabled={mlCategories.length === 0}
                  />
                  {mlCategories.length === 0 && (
                    <div className='mt-3 p-3 bg-amber-950/30 border border-amber-800/50 rounded-lg'>
                      <p className='text-sm text-amber-300'>
                        <AlertTriangle className='inline h-4 w-4 mr-1' />
                        No hay categorías oficiales configuradas. Ve a{' '}
                        <Link href='/admin/categories' className='underline font-medium'>
                          Categorías
                        </Link>{' '}
                        y usa &quot;Actualizar desde Mercado Libre&quot;.
                      </p>
                    </div>
                  )}
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                  <div>
                    <Label
                      htmlFor='mlCondition'
                      className='flex items-center gap-2 text-dark-text-primary'
                    >
                      Condición *
                      {form.mlCondition ? (
                        <CheckCircle className='h-4 w-4 text-emerald-400' />
                      ) : (
                        <AlertCircle className='h-4 w-4 text-amber-400' />
                      )}
                    </Label>
                    <Select
                      value={form.mlCondition}
                      onValueChange={(value) => handleChange('mlCondition', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Seleccionar' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='new'>Nuevo</SelectItem>
                        <SelectItem value='used'>Usado</SelectItem>
                        <SelectItem value='not_specified'>No especificado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label
                      htmlFor='mlBuyingMode'
                      className='flex items-center gap-2 text-dark-text-primary'
                    >
                      Modalidad *
                      {form.mlBuyingMode ? (
                        <CheckCircle className='h-4 w-4 text-emerald-400' />
                      ) : (
                        <AlertCircle className='h-4 w-4 text-amber-400' />
                      )}
                    </Label>
                    <Select
                      value={form.mlBuyingMode}
                      onValueChange={(value) => handleChange('mlBuyingMode', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Seleccionar' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='buy_it_now'>Comprar ahora</SelectItem>
                        <SelectItem value='auction'>Subasta</SelectItem>
                        <SelectItem value='classified'>Clasificado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor='mlCurrencyId' className='text-dark-text-primary'>
                      Moneda *
                    </Label>
                    <Select
                      value={form.mlCurrencyId}
                      onValueChange={(value) => handleChange('mlCurrencyId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Seleccionar' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='ARS'>ARS - Pesos Argentinos</SelectItem>
                        <SelectItem value='USD'>USD - Dólares</SelectItem>
                        <SelectItem value='UYU'>UYU - Pesos Uruguayos</SelectItem>
                        <SelectItem value='CLP'>CLP - Pesos Chilenos</SelectItem>
                        <SelectItem value='COP'>COP - Pesos Colombianos</SelectItem>
                        <SelectItem value='MXN'>MXN - Pesos Mexicanos</SelectItem>
                        <SelectItem value='PEN'>PEN - Soles Peruanos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className='space-y-2'>
                  <div className='flex items-center gap-2 text-xs text-dark-text-secondary'>
                    <div className='flex flex-wrap items-center gap-2'>
                      {listingTypesLoading && <>Cargando tipos disponibles…</>}
                      {!listingTypesLoading && listingTypesSource && (
                        <Badge variant='secondary' className='bg-dark-lightest border-dark-lighter'>
                          {listingTypeSourceLabel[listingTypesSource]}
                        </Badge>
                      )}
                      {!listingTypesLoading && !listingTypesSource && !listingTypesError && (
                        <>Selecciona una categoría para ver opciones disponibles</>
                      )}
                      {listingTypesError && (
                        <span className='text-amber-300'>{listingTypesError}</span>
                      )}
                    </div>
                  </div>
                  <Label
                    htmlFor='mlListingTypeId'
                    className='flex items-center gap-2 text-dark-text-primary'
                  >
                    Tipo de publicación *
                    {form.mlListingTypeId ? (
                      <CheckCircle className='h-4 w-4 text-emerald-400' />
                    ) : (
                      <AlertCircle className='h-4 w-4 text-amber-400' />
                    )}
                  </Label>
                  <Select
                    value={form.mlListingTypeId}
                    onValueChange={(value) => handleChange('mlListingTypeId', value)}
                    disabled={
                      listingTypesLoading ||
                      listingTypeOptions.length === 0 ||
                      listingTypeOptions.every((lt) => lt.available === false)
                    }
                  >
                    <SelectTrigger className={listingTypesError ? 'border-amber-500' : ''}>
                      <SelectValue
                        placeholder={listingTypesLoading ? 'Cargando…' : 'Seleccionar tipo'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {listingTypeOptions.length > 0 ? (
                        listingTypeOptions.map((lt) => {
                          const feeLabel =
                            typeof lt.saleFeePercent === 'number' ? `${lt.saleFeePercent}%` : 'N/D';
                          const remainingLabel =
                            typeof lt.remainingListings === 'number'
                              ? lt.remainingListings > 0
                                ? `${lt.remainingListings} cupos disponibles`
                                : 'Sin cupos'
                              : null;
                          const rangeLabel = lt.priceRange
                            ? [
                                typeof lt.priceRange.min === 'number'
                                  ? `mín. ${lt.priceRange.min.toFixed(2)}`
                                  : null,
                                typeof lt.priceRange.max === 'number'
                                  ? `máx. ${lt.priceRange.max.toFixed(2)}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')
                            : null;

                          return (
                            <SelectItem key={lt.id} value={lt.id} disabled={!lt.available}>
                              <div className='flex flex-col'>
                                <div className='flex items-center gap-2'>
                                  <span>
                                    {lt.name || lt.id} – Comisión {feeLabel}
                                  </span>
                                  <Badge
                                    variant='outline'
                                    className='text-[10px] uppercase tracking-wide border-dark-lighter text-dark-text-secondary'
                                  >
                                    {listingTypeSourceLabel[lt.source]}
                                  </Badge>
                                </div>
                                <div className='text-xs text-dark-text-secondary space-y-0.5'>
                                  {remainingLabel && <div>{remainingLabel}</div>}
                                  {rangeLabel && (
                                    <div>
                                      Rango permitido: {rangeLabel}{' '}
                                      {lt.priceRange?.currency ? lt.priceRange.currency : ''}
                                    </div>
                                  )}
                                  {!lt.available && lt.blockedReason && (
                                    <div className='text-amber-300'>{lt.blockedReason}</div>
                                  )}
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })
                      ) : (
                        <div className='px-3 py-2 text-sm text-dark-text-secondary'>
                          {listingTypesLoading
                            ? 'Cargando opciones…'
                            : listingTypesError
                              ? 'No se pudieron cargar los tipos de publicación.'
                              : 'Selecciona una categoría para ver las opciones disponibles.'}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  {(listingTypesError || currentListingTypeWarning) && (
                    <p className='text-xs text-amber-300'>
                      {currentListingTypeWarning ||
                        `${listingTypesError}. Puedes continuar con el valor actual, pero intenta refrescar más tarde.`}
                    </p>
                  )}
                  {selectedListingType && (
                    <div className='text-xs text-dark-text-secondary space-y-1'>
                      {selectedListingType.remainingListings != null && (
                        <p>
                          Cupos disponibles:{' '}
                          {selectedListingType.remainingListings > 0
                            ? selectedListingType.remainingListings
                            : 'Sin cupos'}
                        </p>
                      )}
                      {selectedListingType.priceRange && (
                        <p>
                          Rango oficial:{' '}
                          {[
                            typeof selectedListingType.priceRange.min === 'number'
                              ? `mín. ${selectedListingType.priceRange.min.toFixed(2)}`
                              : null,
                            typeof selectedListingType.priceRange.max === 'number'
                              ? `máx. ${selectedListingType.priceRange.max.toFixed(2)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}{' '}
                          {selectedListingType.priceRange.currency ?? ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <div>
                    <Label
                      htmlFor='warranty'
                      className='flex items-center gap-2 text-dark-text-primary'
                    >
                      Garantía
                      {form.warranty ? (
                        <CheckCircle className='h-4 w-4 text-emerald-400' />
                      ) : (
                        <span className='text-xs text-dark-text-disabled'>(opcional)</span>
                      )}
                    </Label>
                    <Input
                      id='warranty'
                      value={form.warranty}
                      onChange={(e) => handleChange('warranty', e.target.value)}
                      placeholder='Ej: 90 días, 1 año, sin garantía'
                    />
                  </div>

                  <div>
                    <Label htmlFor='videoId' className='text-dark-text-primary'>
                      ID de Video (opcional)
                    </Label>
                    <Input
                      id='videoId'
                      value={form.videoId}
                      onChange={(e) => handleChange('videoId', e.target.value)}
                      placeholder='ID del video YouTube/Vimeo'
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sección Atributos del Producto */}
            <Card
              id='attributes'
              className={`transition-all bg-dark-lighter border-dark-lighter ${focusedSection === 'attributes' ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : ''}`}
            >
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-dark-text-primary'>
                  <Tag className='h-5 w-5' />
                  Atributos del Producto
                  {recommendedAttributes.filter((attr) => attr.required).length > 0 && (
                    <span className='text-sm font-normal text-red-400'>
                      ({recommendedAttributes.filter((attr) => attr.required).length} requeridos)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasBlockingAttributeIssues && (
                  <Alert variant='destructive' className='mb-4'>
                    <AlertCircle className='h-4 w-4' />
                    <AlertDescription>
                      Completa los atributos obligatorios de la categoría y corrige los valores
                      inválidos antes de continuar.
                    </AlertDescription>
                  </Alert>
                )}

                {invalidAttributeValues.length > 0 && (
                  <Alert className='mb-4 border-amber-500/50 bg-amber-500/10'>
                    <AlertCircle className='h-4 w-4 text-amber-400' />
                    <AlertDescription className='space-y-1 text-sm'>
                      {invalidAttributeValues.map((item, idx) => (
                        <div key={`${item.attribute.id}-${idx}`}>
                          • <strong>{item.attribute.name ?? item.attribute.id}</strong>:{' '}
                          {item.reason}
                        </div>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}

                <MLAttributesGuide
                  categoryId={form.mlCategoryId}
                  attributes={attributes}
                  onAttributesChange={setAttributes}
                  showValidationErrors={readinessScore < 100}
                  totalRequired={attributeEvaluation?.totals.required ?? 0}
                  totalConditional={attributeEvaluation?.totals.conditional ?? 0}
                  missingRequiredCount={missingRequiredCount}
                  missingConditionalCount={missingConditionalCount}
                  invalidValues={invalidAttributeValues}
                />
              </CardContent>
            </Card>

            {/* Opciones adicionales */}
            <Card
              id='warranty'
              className={`transition-all bg-dark-lighter border-dark-lighter ${focusedSection === 'warranty' ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : ''}`}
            >
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-dark-text-primary'>
                  <Star className='h-5 w-5' />
                  Opciones Adicionales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='flex items-center space-x-3 p-4 rounded-lg border bg-dark-lightest'>
                  <input
                    type='checkbox'
                    id='destacado'
                    checked={form.destacado}
                    onChange={(e) => handleChange('destacado', e.target.checked)}
                    className='h-4 w-4 rounded border-dark-lighter text-blue-500 focus:ring-blue-500'
                  />
                  <div className='flex-1'>
                    <Label
                      htmlFor='destacado'
                      className='text-sm font-medium cursor-pointer text-dark-text-primary'
                    >
                      Producto destacado
                    </Label>
                    <p className='text-xs text-dark-text-secondary mt-1'>
                      Los productos destacados aparecen primero en la tienda
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Botones de acción */}
            <div className='flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-dark-lighter bg-dark-lighter sticky bottom-0'>
              <Link href='/admin/products'>
                <Button type='button' variant='outline' className='w-full sm:w-auto'>
                  Cancelar
                </Button>
              </Link>
              <Button
                type='submit'
                disabled={loading || readinessScore < 100}
                className='w-full sm:w-auto'
                onClick={handleSubmit}
              >
                <Save className='mr-2 h-4 w-4' />
                {loading ? 'Creando...' : 'Crear Producto'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
